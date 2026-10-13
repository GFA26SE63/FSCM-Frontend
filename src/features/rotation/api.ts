import { get, post, put } from '@/shared/api/http';
import type { ProposalDetail, ProposalList, RotationProposal, RunResult } from './types';

const enc = encodeURIComponent;

export const rotationApi = {
  list: () => get<ProposalList>('/rotation/proposals'),
  get: (id: string) => get<ProposalDetail>(`/rotation/proposals/${enc(id)}`),
  approve: (id: string) => post<RotationProposal>(`/rotation/proposals/${enc(id)}/approve`),
  skip: (id: string) => post<RotationProposal>(`/rotation/proposals/${enc(id)}/skip`),
  updateQty: (v: { id: string; qty: number }) => put<RotationProposal>(`/rotation/proposals/${enc(v.id)}`, { qty: v.qty }),
  run: () => post<RunResult>('/rotation/run'),
};
