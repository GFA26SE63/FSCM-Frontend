import { del, post, put } from '@/shared/api/http';
import { graphql } from '@/shared/api/graphql';
import type { CreateRoleInput, RoleItem, ScreenFeature, UpdateRoleInput } from './types';

export const roleApi = {
  list: async (search?: string): Promise<RoleItem[]> =>
    (await graphql<{ entities: { roleReads: RoleItem[] } }>(
      `query Roles($search: String) { entities { roleReads(search: $search) {
        id code baseRole name description isSystem permissions userCount createdAt updatedAt
      } } }`, { search: search?.trim() || null })).entities.roleReads,

  getById: async (id: string): Promise<RoleItem> =>
    (await graphql<{ entities: { roleRead: RoleItem } }>(
      `query Role($id: UUID!) { entities { roleRead(id: $id) {
        id code baseRole name description isSystem permissions userCount createdAt updatedAt
      } } }`, { id })).entities.roleRead,

  getScreens: async (): Promise<ScreenFeature[]> =>
    (await graphql<{ entities: { screenFeatures: ScreenFeature[] } }>(
      `query RoleScreens { entities { screenFeatures { key name description groupKey groupLabel } } }`
    )).entities.screenFeatures,

  create: (data: CreateRoleInput): Promise<RoleItem> =>
    post<RoleItem>('/roles', data),

  update: (id: string, data: UpdateRoleInput): Promise<RoleItem> =>
    put<RoleItem>(`/roles/${id}`, data),

  delete: async (id: string): Promise<void> => {
    await del(`/roles/${id}`);
  },
};

