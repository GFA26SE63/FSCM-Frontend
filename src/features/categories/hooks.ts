import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { categoryApi } from './api';

export const useCategories = (includeInactive = true) =>
  useQuery({ queryKey: ['categories', 'list', includeInactive], queryFn: () => categoryApi.list(includeInactive) });

export const useCategory = (code: string) =>
  useQuery({ queryKey: ['categories', 'detail', code], queryFn: () => categoryApi.get(code), enabled: !!code });

export const useCreateCategory = () =>
  useApiMutation(categoryApi.create, { success: (c) => `Đã tạo danh mục ${c.code} · ${c.name}.` });

export const useUpdateCategory = () =>
  useApiMutation(categoryApi.update, { success: (c) => `Đã cập nhật danh mục ${c.code}.` });

export const useUpdateCategoryStatus = () =>
  useApiMutation(
    ({ idOrCode, isActive }: { idOrCode: string; isActive: boolean }) => categoryApi.updateStatus(idOrCode, isActive),
    { success: (_, { isActive }) => `Đã chuyển danh mục sang ${isActive ? 'Hoạt động' : 'Ngừng hoạt động'}.` },
  );

