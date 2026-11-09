import { get, getAll, http, post } from '@/shared/api/http';
import type { Option, User, UserInput } from './types';

interface ApiUser { id: string; email: string; fullName: string; role: User['role']; isActive?: boolean; updatedAt?: string; scopeLabels?: { warehouses?: string[]; salesGroups?: string[]; retailers?: string[]; regions?: string[] } }
interface CreatedUser { userId: string; email: string; role: User['role'] }
const map = (u: ApiUser): User => ({ id: u.id, name: u.fullName, loginName: u.email, role: u.role, scope: [...(u.scopeLabels?.warehouses ?? []), ...(u.scopeLabels?.salesGroups ?? []), ...(u.scopeLabels?.retailers ?? []), ...(u.scopeLabels?.regions ?? [])].join(', ') || 'Toàn hệ thống', status: u.isActive === false ? 'Locked' : 'Active', lastLoginAt: u.updatedAt ?? null });

export const userApi = {
  list: async () => (await getAll<ApiUser>('/users')).map(map),
  get: async (id: string) => map(await get<ApiUser>(`/users/${encodeURIComponent(id)}`)),
  create: async (v: UserInput) => {
    const created = await post<CreatedUser>('/users', { email: v.email, fullName: v.name, role: v.role, identityProvider: 'Local' });
    return { id: created.userId, name: v.name, loginName: created.email, role: created.role, scope: 'Chưa gán', status: 'Active' as const, lastLoginAt: null };
  },
  setStatus: async (v: { id: string; status: User['status'] }) => {
    await http.patch(`/users/${encodeURIComponent(v.id)}/status`, { isActive: v.status === 'Active' });
    return userApi.get(v.id);
  },
  warehouses: async (): Promise<Option[]> => (await getAll<{ code: string; name: string }>('/warehouses')).map((w) => ({ code: w.code, name: w.name })),
  groups: () => getAll<{ code: string }>('/sales-groups').then((x) => x.map((g) => ({ code: g.code, name: g.code }))),
  retailers: async (): Promise<Option[]> => (await getAll<{ code: string; name: string }>('/retailers')).map((r) => ({ code: r.code, name: r.name })),
};
