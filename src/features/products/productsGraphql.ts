/**
 * Products via GraphQL `entities.products` (HotChocolate cursor pagination).
 *
 * Fields confirmed safe from the ProductEntity domain entity:
 *   id, sku, name, unit, status, productCategoryId, replacesProductId,
 *   shelfLifeHours, nearDateThresholdHours, createdAt, updatedAt
 *
 * NOT in this query:
 *   currentUnitPrice — fetched separately via entities.productPrices batch (see fetchProductPrices)
 *   publishedAt, inactivatedAt — confirmed on entity but not needed in list; available via REST detail
 *   categoryCode, categoryName — denormalized joins; populated client-side from categories cache
 *
 * Price enrichment strategy (Phase 2.3):
 *   After the product page loads, product IDs are passed to fetchProductPrices().
 *   That function queries entities.productPrices(where: { productId: { in: ids }, isActive: { eq: true } }).
 *   Each product has at most one isActive=true price (business rule: one common price per product).
 *   Errors in price fetching do not fail the product list — prices show null until resolved.
 *
 * HC0047: first/last must be literals in the query string, not variables.
 * HC0078: invalid/expired cursor returns code HC0078.
 */

import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import type { PageInfo } from '@/shared/pagination/types';
import type { Product } from './types';

export const PRODUCTS_PAGE_SIZES = [10, 20, 50] as const;
export type ProductPageSize = (typeof PRODUCTS_PAGE_SIZES)[number];

export interface ProductsPageQuery {
  size: ProductPageSize;
  after?: string;
  before?: string;
  status?: string;
  categoryId?: string;
  search?: string;
}

interface RawProductNode {
  id: string;
  sku: string;
  name: string;
  unit: string;
  status: string;
  productCategoryId: string;
  replacesProductId: string | null;
  shelfLifeHours: number;
  nearDateThresholdHours: number;
  createdAt: string;
  updatedAt: string;
}

interface ProductsConnection {
  totalCount?: number;
  pageInfo?: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  nodes?: RawProductNode[] | null;
}

function mapNode(n: RawProductNode): Product {
  return {
    id: n.id,
    sku: n.sku,
    name: n.name,
    unit: n.unit,
    status: n.status as Product['status'],
    productCategoryId: n.productCategoryId,
    categoryCode: '',
    categoryName: '',
    replacesProductId: n.replacesProductId,
    shelfLifeHours: n.shelfLifeHours,
    nearDateThresholdHours: n.nearDateThresholdHours,
    currentUnitPrice: null,
    publishedAt: null,
    inactivatedAt: null,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

function buildFilter(q: ProductsPageQuery): {
  conditions: string[];
  declarations: string[];
  variables: Record<string, unknown>;
} {
  const conditions: string[] = [];
  const declarations: string[] = [];
  const variables: Record<string, unknown> = {};

  if (q.status) {
    conditions.push('{ status: { eq: $status } }');
    declarations.push('$status: String!');
    variables.status = q.status;
  }

  if (q.categoryId) {
    conditions.push('{ productCategoryId: { eq: $categoryId } }');
    declarations.push('$categoryId: UUID!');
    variables.categoryId = q.categoryId;
  }

  if (q.search) {
    conditions.push('{ or: [{ name: { contains: $search } }, { sku: { contains: $search } }] }');
    declarations.push('$search: String!');
    variables.search = q.search;
  }

  return { conditions, declarations, variables };
}

const whereOf = (conditions: string[]) =>
  conditions.length ? `where: { and: [${conditions.join(', ')}] }` : '';

export function buildProductsPageQuery(q: ProductsPageQuery): {
  query: string;
  variables: Record<string, unknown>;
} {
  if (!PRODUCTS_PAGE_SIZES.includes(q.size)) throw new Error('invalid page size');

  const { conditions, declarations, variables } = buildFilter(q);
  const backward = !!q.before;
  const paging = backward
    ? `last: ${q.size}, before: $before`
    : `first: ${q.size}${q.after ? ', after: $after' : ''}`;

  if (backward) {
    declarations.push('$before: String!');
    variables.before = q.before;
  } else if (q.after) {
    declarations.push('$after: String!');
    variables.after = q.after;
  }

  const order = 'order: [{ createdAt: DESC }, { id: DESC }]';
  const decl = declarations.length ? `(${declarations.join(', ')})` : '';

  const query = `query ProductsPage${decl} {
  entities {
    page: products(${[paging, whereOf(conditions), order].filter(Boolean).join(', ')}) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      nodes {
        id sku name unit status productCategoryId replacesProductId
        shelfLifeHours nearDateThresholdHours createdAt updatedAt
      }
    }
  }
}`;

  return { query, variables };
}

export interface ProductsPage {
  rows: Product[];
  totalCount: number;
  pageInfo: PageInfo;
}

function friendlyError(err: unknown): unknown {
  if (!(err instanceof ApiError)) return err;
  if (err.status === 401 || err.status === 403) return err;
  if (err.status === 400 && err.code === 'HC0078') {
    return new ApiError(
      400,
      'Trang không hợp lệ',
      'Trang đã chọn không còn hợp lệ. Hãy quay về trang đầu.',
      err.code,
    );
  }
  if (err.status === 400) {
    return new ApiError(
      400,
      'Không tải được dữ liệu',
      'Không tải được danh sách sản phẩm. Vui lòng thử lại.',
      err.code,
    );
  }
  return err;
}

// ---------------------------------------------------------------------------
// Price enrichment — entities.productPrices batch fetch
// ---------------------------------------------------------------------------

interface RawPriceNode {
  productId: string;
  unitPrice: number;
  isActive: boolean;
}

/**
 * Fetch active prices for a set of product IDs in one GraphQL request.
 *
 * Selection rule: isActive === true (one active price per product at any time).
 * Uses first: 50 literal (HC0047) — matches max page size, so at most one
 * price per product row.
 *
 * Returns a Map<productId, unitPrice>. Errors are swallowed — price fetch
 * failure must not break the product list.
 */
export async function fetchProductPrices(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  try {
    const query = `query ProductPricesForPage($ids: [UUID!]!) {
  entities {
    productPrices(first: 50, where: { and: [{ productId: { in: $ids } }, { isActive: { eq: true } }] }) {
      nodes { productId unitPrice isActive }
    }
  }
}`;
    const data = await graphql<{ entities: { productPrices: { nodes: RawPriceNode[] | null } } }>(
      query,
      { ids: productIds },
    );
    const nodes = data?.entities?.productPrices?.nodes;
    if (!Array.isArray(nodes)) return new Map();
    const map = new Map<string, number>();
    for (const n of nodes) {
      if (n.isActive && typeof n.unitPrice === 'number') {
        map.set(n.productId, n.unitPrice);
      }
    }
    return map;
  } catch (err) {
    console.warn('[productsGraphql] fetchProductPrices failed — prices will show as null:', err);
    return new Map();
  }
}

export async function fetchProductsPage(q: ProductsPageQuery): Promise<ProductsPage> {
  try {
    const { query, variables } = buildProductsPageQuery(q);
    const data = await graphql<{ entities: { page: ProductsConnection } }>(query, variables);
    const page = data.entities?.page;
    if (
      !page ||
      typeof page.totalCount !== 'number' ||
      !page.pageInfo ||
      !Array.isArray(page.nodes)
    ) {
      throw new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi sản phẩm thiếu thông tin phân trang.');
    }
    return {
      rows: page.nodes.map(mapNode),
      totalCount: page.totalCount,
      pageInfo: page.pageInfo as PageInfo,
    };
  } catch (err) {
    throw friendlyError(err);
  }
}
