import { del, get, post, put } from '@/shared/api/http';
import type { CreateRoleInput, RoleItem, ScreenFeature, UpdateRoleInput } from './types';

export const roleApi = {
  list: (search?: string): Promise<RoleItem[]> =>
    get<RoleItem[]>('/roles', search?.trim() ? { search: search.trim() } : undefined),

  getById: (id: string): Promise<RoleItem> =>
    get<RoleItem>(`/roles/${id}`),

  getScreens: (): Promise<ScreenFeature[]> =>
    get<ScreenFeature[]>('/roles/screens'),

  create: (data: CreateRoleInput): Promise<RoleItem> =>
    post<RoleItem>('/roles', data),

  update: (id: string, data: UpdateRoleInput): Promise<RoleItem> =>
    put<RoleItem>(`/roles/${id}`, data),

  delete: async (id: string): Promise<void> => {
    await del(`/roles/${id}`);
  },
};

