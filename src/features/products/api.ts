import { del, get, post, put } from '@/shared/api/http';
import { ApiError } from '@/shared/api/errors';

import type {
  CategoryOption,
  CreateProductInput,
  Product,
  ProductFields,
  ProductPage,
  ProductPrice,
} from './types';

const path = (id: string) =>
  '/products/' + encodeURIComponent(id);

async function list(): Promise<Product[]> {
  const products: Product[] = [];

  for (let page = 1; ; page += 1) {
    const result = await get<ProductPage>('/products', {
      page,
      pageSize: 100,
    });

    products.push(...result.items);

    if (
      page >= result.totalPages ||
      result.items.length === 0
    ) {
      break;
    }
  }

  return products;
}

export const productApi = {
  list,

  get: async (identifier: string): Promise<Product> => {
    let id = identifier;

    // Giữ tương thích các link cũ từ màn danh mục.
    if (/^SKU[0-9]{3}$/i.test(identifier)) {
      const product = (await list()).find(
        (p) => p.sku === identifier.toUpperCase(),
      );

      if (!product) {
        throw new ApiError(
          404,
          'Không tìm thấy sản phẩm',
        );
      }

      id = product.id;
    }

    return get<Product>(path(id));
  },

  categories: () =>
    get<CategoryOption[]>('/categories', {
      includeInactive: true,
    }),

  create: (input: CreateProductInput) =>
    post<Product>('/products', input),

  update: ({
    id,
    ...input
  }: ProductFields & { id: string }) =>
    put<Product>(path(id), input),

  remove: (id: string) =>
    del<void>(path(id)),

  publish: (id: string) =>
    post<Product>(path(id) + '/publish'),

  inactivate: (id: string) =>
    post<void>(path(id) + '/inactivate'),

  setPrice: async ({
    id,
    unitPrice,
  }: {
    id: string;
    unitPrice: number;
  }): Promise<ProductPrice> => {
    const current = await productApi.get(id);
    if (current.status !== 'Draft') {
      throw new ApiError(409, 'Giá đã khóa', 'Chỉ bản nháp được chỉnh giá. Hãy tạo bản mới từ sản phẩm đã đăng bán.');
    }
    return post<ProductPrice>(
      path(id) + '/prices',
      { unitPrice },
    );
  },

  replacement: ({ id, ...input }: Omit<CreateProductInput, 'productCategoryId'> & { id: string }) =>
    post<Product>(path(id) + '/replacement', input),

  clone: ({
    id,
    sku,
  }: {
    id: string;
    sku: string;
  }) =>
    post<Product>(
      path(id) + '/clone',
      { sku },
    ),
};
