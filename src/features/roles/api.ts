import { get, http, post, put } from '@/shared/api/http';
import type { CreateRoleInput, RoleItem, ScreenFeature, UpdateRoleInput } from './types';

export const roleApi = {
  list: (search?: string): Promise<RoleItem[]> =>
    get<RoleItem[]>('/api/v1/roles', {
      params: search?.trim() ? { search: search.trim() } : undefined,
    }),

  getById: (id: string): Promise<RoleItem> =>
    get<RoleItem>(`/api/v1/roles/${id}`),

  getScreens: (): Promise<ScreenFeature[]> =>
    get<ScreenFeature[]>('/api/v1/roles/screens'),

  create: (data: CreateRoleInput): Promise<RoleItem> =>
    post<RoleItem>('/api/v1/roles', data),

  update: (id: string, data: UpdateRoleInput): Promise<RoleItem> =>
    put<RoleItem>(`/api/v1/roles/${id}`, data),

  delete: async (id: string): Promise<void> => {
    await http.delete(`/api/v1/roles/${id}`);
  },
};
