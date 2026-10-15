import { getAll, post } from '@/shared/api/http';
import type { CollectResult, Receivable } from './types';

export const debtApi = {
  list: () => getAll<Receivable>('/receivables'),
  /** Single full collection – no partial payments (SPEC §4 Finance). */
  collect: (v: { orderCode: string; method: 'Cash' | 'Transfer' }) => post<CollectResult>(`/receivables/${v.orderCode}/collect`, { method: v.method }),
};
