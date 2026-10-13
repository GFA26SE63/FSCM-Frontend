import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { categoryApi } from './api';

export const useCategories = () => useQuery({ queryKey: ['categories', 'list'], queryFn: categoryApi.list });
export const useCategory = (code: string) => useQuery({ queryKey: ['categories', 'detail', code], queryFn: () => categoryApi.get(code) });
export const useCreateCategory = () => useApiMutation(categoryApi.create, { success: (c) => `Đã tạo danh mục ${c.code} · ${c.name}.` });
export const useUpdateCategory = () => useApiMutation(categoryApi.update, { success: (c) => `Đã cập nhật danh mục ${c.code}.` });
