import { get, getAll } from '@/shared/api/http';
import type { Batch, BatchDetail } from './types';

export const batchApi = {
  list: () => getAll<Batch>('/batches'),
  get: (code: string) => get<BatchDetail>(`/batches/${code}`),
};
