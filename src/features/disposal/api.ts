import { get, getAll, post } from '@/shared/api/http';
import type { Disposal, DisposalCandidate, DisposalInput } from './types';

export const disposalApi = {
  list: () => getAll<Disposal>('/disposals'),
  get: (code: string) => get<Disposal>(`/disposals/${code}`),
  candidates: () => get<DisposalCandidate[]>('/disposals/candidates'),
  create: (input: DisposalInput) => post<{ items: Disposal[] }>('/disposals', input),
};
