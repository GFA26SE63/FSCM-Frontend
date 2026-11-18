import { get, post } from '@/shared/api/http';
import { graphql } from '@/shared/api/graphql';
import type { Disposal, DisposalCandidate, DisposalInput } from './types';

export const disposalApi = {
  list: () => graphql<{ entities: { disposalReads: Disposal[] } }>(`query DisposalReads { entities { disposalReads { code warehouseCode warehouseName createdAt createdBy reason method batchCount totalQty totalValue lines { sku productName batchCode expiry qty } } } }`).then(x => x.entities.disposalReads),
  get: (code: string) => get<Disposal>(`/disposals/${code}`),
  candidates: () => get<DisposalCandidate[]>('/disposals/candidates'),
  create: (input: DisposalInput) => post<{ items: Disposal[] }>('/disposals', input),
};
