import { get, post, put } from '@/shared/api/http';
import type { Complaint, ComplaintEvidence } from './types';

export type ComplaintDecision = 'requestEvidence' | 'approve' | 'reject';

const findId = async (code: string, id?: string) => {
  const resolved = id ?? (await get<Complaint[]>('/complaints')).find((x) => x.code === code)?.id;
  if (!resolved) throw new Error('Complaint not found');
  return resolved;
};

export const complaintApi = {
  list: () => get<Complaint[]>('/complaints'),
  get: (code: string) => get<Complaint[]>('/complaints').then((items) => items.find((x) => x.code === code) ?? Promise.reject(new Error('Complaint not found'))),
  resolve: async (v: { code: string; result: string; approved: boolean; id?: string }) => {
    const id = await findId(v.code, v.id);
    return post<Complaint>(`/complaints/${id}/resolve`, { result: v.result, approved: v.approved });
  },
  evidence: (id: string) => get<ComplaintEvidence[]>(`/complaints/${id}/evidence`),
  /** F62: review actions. Admin approves/rejects; Admin or Operator requests more evidence. */
  decide: async (v: { code: string; decision: ComplaintDecision; text: string; id?: string }) => {
    const id = await findId(v.code, v.id);
    switch (v.decision) {
      case 'requestEvidence':
        return put<Complaint>(`/complaints/${id}/request-evidence`, { reason: v.text });
      case 'reject':
        return post<Complaint>(`/complaints/${id}/reject`, { reason: v.text });
      default:
        return post<Complaint>(`/complaints/${id}/approve`, { note: v.text });
    }
  },
};
