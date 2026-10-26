import { get, post } from '@/shared/api/http';
import type { Complaint } from './types';

export const complaintApi = {
  list: () => get<Complaint[]>('/complaints'),
  get: (code: string) => get<Complaint[]>('/complaints').then((items) => items.find((x) => x.code === code) ?? Promise.reject(new Error('Complaint not found'))),
  resolve: async (v: { code: string; result: string; id?: string }) => {
    const id = v.id ?? (await get<Complaint[]>('/complaints')).find((x) => x.code === v.code)?.id;
    if (!id) throw new Error('Complaint not found');
    return post<Complaint>(`/complaints/${id}/resolve`, { result: v.result });
  },
};
