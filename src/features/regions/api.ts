import { get, getAll, post, put } from '@/shared/api/http';
import type { Area, AreaInput, GroupInput, SalesGroup, SalesStaff, TransferInput } from './types';

export const regionApi = {
  areas: () => getAll<Area>('/areas'),
  createArea: (v: AreaInput) => post<Area>('/areas', v),
  groups: () => getAll<SalesGroup>('/sales-groups'),
  group: (code: string) => get<SalesGroup>(`/sales-groups/${code}`),
  createGroup: (v: GroupInput) => post<SalesGroup>('/sales-groups', v),
  updateGroup: (v: GroupInput) => put<SalesGroup>(`/sales-groups/${v.code}`, v),
  staff: () => get<SalesStaff[]>('/sales-staff'),
  transfer: (v: TransferInput) => post<{ name: string; fromGroup: string | null; toGroup: string }>('/sales-staff/transfer', v),
};
