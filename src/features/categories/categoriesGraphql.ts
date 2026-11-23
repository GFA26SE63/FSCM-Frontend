import { graphql } from "@/shared/api/graphql";

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export interface GraphCategory {
  id: string;
  parentCategoryId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  defaultMlorRatio?: number | null;
  defaultMlorVersion?: number;
  defaultMlorUpdatedAt?: string | null;
}

export interface GraphProduct {
  id: string;
  productCategoryId: string;
  sku: string;
  name: string;
  unit?: string;
  status: string;
}

interface Connection<T> {
  nodes?: T[] | null;
  pageInfo?: { hasNextPage: boolean; endCursor: string | null };
}

async function collect<T, TData>(
  query: string,
  variables: Record<string, unknown>,
  read: (data: TData) => Connection<T>,
): Promise<T[]> {
  const all: T[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await graphql<TData>(query, { ...variables, after });
    const connection = read(data);
    if (!Array.isArray(connection.nodes))
      throw new Error("Phản hồi GraphQL thiếu danh sách dữ liệu.");
    all.push(...connection.nodes);
    const next = connection.pageInfo?.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
    if (!next || next === after) return all;
    after = next;
  }
  throw new Error(
    "Danh sách danh mục hoặc sản phẩm vượt giới hạn tải an toàn.",
  );
}

const categoriesQuery = `query CategoryTree($after: String) {
  entities { productCategories(first: ${PAGE_SIZE}, after: $after, order: [{ code: ASC }]) {
    pageInfo { hasNextPage endCursor }
    nodes { id parentCategoryId code name description isActive createdAt updatedAt defaultMlorRatio defaultMlorVersion defaultMlorUpdatedAt }
  } }
}`;

export const fetchCategoriesGraphql = () =>
  collect<
    GraphCategory,
    { entities: { productCategories: Connection<GraphCategory> } }
  >(categoriesQuery, {}, (data) => data.entities.productCategories);

const productsQuery = `query CategoryBranchProducts($categoryIds: [UUID!]!, $after: String) {
  entities { products(first: ${PAGE_SIZE}, after: $after, where: { productCategoryId: { in: $categoryIds } }, order: [{ sku: ASC }]) {
    pageInfo { hasNextPage endCursor }
    nodes { id productCategoryId sku name unit status }
  } }
}`;

export const fetchProductsByCategoryIdsGraphql = (categoryIds: string[]) =>
  categoryIds.length
    ? collect<
        GraphProduct,
        { entities: { products: Connection<GraphProduct> } }
      >(productsQuery, { categoryIds }, (data) => data.entities.products)
    : Promise.resolve([]);

interface PriceNode {
  productId: string;
  unitPrice: number;
}

export async function fetchCurrentProductPricesGraphql(
  productIds: string[],
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  for (let start = 0; start < productIds.length; start += PAGE_SIZE) {
    const ids = productIds.slice(start, start + PAGE_SIZE);
    const query = `query CategoryProductPrices($ids: [UUID!]!) {
      entities { productPrices(first: ${PAGE_SIZE}, where: { and: [{ productId: { in: $ids } }, { isActive: { eq: true } }] }) {
        nodes { productId unitPrice }
      } }
    }`;
    const data = await graphql<{
      entities: { productPrices: { nodes?: PriceNode[] | null } };
    }>(query, { ids });
    for (const price of data.entities.productPrices.nodes ?? [])
      prices.set(price.productId, price.unitPrice);
  }
  return prices;
}
