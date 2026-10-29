import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { productApi } from './api';

export const useProducts = () =>
  useQuery({
    queryKey: ['products', 'list'],
    queryFn: productApi.list,
  });

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