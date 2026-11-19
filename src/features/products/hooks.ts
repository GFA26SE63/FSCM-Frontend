import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { productApi } from './api';
import { saveProductDraft } from './saveDraft';
import { fetchProductsPage, fetchProductPrices, type ProductsPageQuery } from './productsGraphql';

export const useSaveProductDraft = () => useApiMutation(saveProductDraft, {
  permission: 'products.manage', success: (p) => 'Đã lưu bản nháp ' + p.sku + '.',
});
export const useCreateReplacement = () => useApiMutation(productApi.replacement, {
  permission: 'products.manage', success: (p) => 'Đã tạo bản thay thế ' + p.sku + '.',
});

export const useProducts = () =>
  useQuery({
    queryKey: ['products', 'list'],
    queryFn: productApi.listAll,
  });

/** Server-side cursor-paginated products via GraphQL entities.products. */
export const useProductsPage = (q: ProductsPageQuery) =>
  useQuery({
    queryKey: ['products', 'page', q],
    queryFn: () => fetchProductsPage(q),
    placeholderData: (prev) => prev,
    retry: false,
    staleTime: 15_000,
  });

/**
 * Batch-fetch active prices for the given product IDs via entities.productPrices.
 * Returns a Map<productId, unitPrice>. Never throws — errors yield an empty map.
 * The key is sorted so React Query deduplicates across re-renders with the same set.
 */
export const useProductPricesForPage = (productIds: string[]) => {
  const sortedIds = [...productIds].sort();
  return useQuery({
    queryKey: ['products', 'prices', sortedIds],
    queryFn: () => fetchProductPrices(sortedIds),
    enabled: sortedIds.length > 0,
    staleTime: 60_000,
    retry: false,
  });
};

export const useProduct = (id: string) =>
  useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: () => productApi.get(id),
    enabled: Boolean(id),
  });

export const useCategoryOptions = (enabled = true) =>
  useQuery({
    queryKey: ['products', 'categories'],
    queryFn: productApi.categories,
    enabled,
  });

export const useCreateProduct = () =>
  useApiMutation(productApi.create, {
    permission: 'products.manage',
    success: (p) =>
      'Đã tạo bản nháp ' + p.sku + '.',
  });

export const useUpdateProduct = () =>
  useApiMutation(productApi.update, {
    permission: 'products.manage',
    success: (p) =>
      'Đã lưu bản nháp ' + p.sku + '.',
  });

export const useDeleteProduct = () =>
  useApiMutation(productApi.remove, {
    permission: 'products.manage',
    success: 'Đã xóa bản nháp.',
  });

export const usePublishProduct = () =>
  useApiMutation(productApi.publish, {
    permission: 'products.manage',
    success: (p) =>
      'Đã đăng bán ' + p.sku + '.',
  });

export const useInactivateProduct = () =>
  useApiMutation(productApi.inactivate, {
    permission: 'products.manage',
    success: 'Đã ngừng bán sản phẩm.',
  });

export const useSetProductPrice = () =>
  useApiMutation(productApi.setPrice, {
    permission: 'products.manage',
    success: 'Đã cập nhật giá sản phẩm.',
  });

export const useCloneProduct = () =>
  useApiMutation(productApi.clone, {
    permission: 'products.manage',
    success: (p) =>
      'Đã tạo bản nháp độc lập ' + p.sku + '.',
  });
