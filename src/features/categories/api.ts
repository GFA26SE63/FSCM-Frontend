import { get, getAll, post, put } from '@/shared/api/http';
import type { Category, CategoryDetail, CategoryInput } from './types';

export const categoryApi = {
  list: () => getAll<Category>('/categories'),
  get: (code: string) => get<CategoryDetail>(`/categories/${code}`),
  create: (v: CategoryInput) => post<Category>('/categories', v),
  update: (v: CategoryInput & { code: string }) => put<Category>(`/categories/${v.code}`, v),
};
