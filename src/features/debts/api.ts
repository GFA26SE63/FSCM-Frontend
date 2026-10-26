import { get, http } from '@/shared/api/http';
import type { Receivable } from './types';

export const debtApi = {
  list: () => get<Receivable[]>('/receivables'),
  /** Single full collection – no partial payments (SPEC §4 Finance). */
  collect: (v: { orderId: string; collectionMethod: 'Cash' | 'BankTransfer'; expectedVersion: number; operationKey: string }) =>
    http.post<Receivable>(`/payments/orders/${v.orderId}/collect`, {
      collectionMethod: v.collectionMethod,
      expectedVersion: v.expectedVersion,
      note: 'Portal xác nhận đã đối soát thu đủ công nợ',
    }, { headers: { 'Idempotency-Key': v.operationKey } }).then((r) => r.data),
};
