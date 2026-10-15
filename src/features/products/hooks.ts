import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { productApi } from './api';

export const useProducts = () => useQuery({ queryKey: ['products', 'list'], queryFn: productApi.list });
export const useProduct = (sku: string) => useQuery({ queryKey: ['products', 'detail', sku], queryFn: () => productApi.get(sku) });
export const useCategoryOptions = (enabled = true) => useQuery({ queryKey: ['products', 'categories'], queryFn: productApi.categories, enabled });
export const useCreateProduct = () => useApiMutation(productApi.create, { success: (p) => `Đã tạo bản nháp ${p.sku}.` });
export const useUpdateProduct = () => useApiMutation(productApi.update, { success: (p) => `Đã lưu bản nháp ${p.sku}.` });
export const useDeleteProduct = () => useApiMutation(productApi.remove, { success: 'Đã xóa bản nháp.' });
export const usePublishProduct = () => useApiMutation(productApi.publish, { success: (p) => `Đã publish ${p.sku}; thông tin được khóa.` });
export const useInactivateProduct = () => useApiMutation(productApi.inactivate, { success: (p) => `Đã chuyển ${p.sku} sang Inactive.` });
export const useCloneProduct = () => useApiMutation(productApi.clone, { success: (p) => `Đã tạo bản nháp ${p.sku} thay thế ${p.replaceOf}.` });
