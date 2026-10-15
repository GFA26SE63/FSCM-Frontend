import { get, getAll, post, put } from '@/shared/api/http';
import type { Option, User, UserInput } from './types';

export const userApi = {
  list: () => getAll<User>('/users'),
  get: (id: string) => get<User>(`/users/${encodeURIComponent(id)}`),
  create: (v: UserInput) => post<User>('/users', v),
  setStatus: (v: { id: string; status: User['status'] }) => put<User>(`/users/${encodeURIComponent(v.id)}`, { status: v.status }),
  warehouses: () => getAll<Option>('/warehouses'),
  groups: () => getAll<{ code: string }>('/sales-groups').then((x) => x.map((g) => ({ code: g.code, name: g.code }))),
  retailers: () => getAll<Option>('/retailers'),
};
