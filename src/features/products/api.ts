import { del, get, getAll, post, put } from '@/shared/api/http';
import type { CategoryOption, Product, ProductDetail, ProductInput } from './types';

export const productApi = {
  list: () => getAll<Product>('/products'),
  get: (sku: string) => get<ProductDetail>(`/products/${sku}`),
  create: (v: ProductInput) => post<ProductDetail>('/products', v),
  update: (v: ProductInput & { sku: string }) => put<ProductDetail>(`/products/${v.sku}`, v),
  remove: (sku: string) => del(`/products/${sku}`),
  publish: (sku: string) => post<ProductDetail>(`/products/${sku}/publish`),
  inactivate: (sku: string) => post<ProductDetail>(`/products/${sku}/inactivate`),
  /** "Tạo bản mới": copy into a Draft that replaces the published/inactive SKU once published. */
  clone: (sku: string) => post<ProductDetail>(`/products/${sku}/clone`),
  categories: () => getAll<CategoryOption>('/categories'),
};
