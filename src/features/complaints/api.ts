import { get, getAll, post } from '@/shared/api/http';
import type { Complaint } from './types';

export const complaintApi = {
  list: () => getAll<Complaint>('/complaints'),
  get: (code: string) => get<Complaint>(`/complaints/${code}`),
  resolve: (v: { code: string; result: string }) => post<Complaint>(`/complaints/${v.code}/resolve`, { result: v.result }),
};
