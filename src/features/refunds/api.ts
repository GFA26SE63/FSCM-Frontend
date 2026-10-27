import { get, http } from '@/shared/api/http';
import type { CreateRefundInput, Refund, RefundEvidenceInput, VerifyRefundInput } from './types';

const key = (operationKey: string) => ({ headers: { 'Idempotency-Key': operationKey } });

export const refundApi = {
  list: () => get<Refund[]>('/refunds'),
  create: (v: CreateRefundInput) => http.post<Refund>('/refunds', {
    salesOrderId: v.salesOrderId,
    amount: v.amount,
    recipient: v.recipient,
    reason: v.reason,
  }, key(v.operationKey)).then((r) => r.data),
  submitEvidence: (v: RefundEvidenceInput) => http.post<Refund>(`/refunds/${v.id}/evidence`, {
    expectedVersion: v.expectedVersion,
    transferredAt: v.transferredAt,
    transactionReference: v.transactionReference,
    evidenceReference: v.evidenceReference,
  }, key(v.operationKey)).then((r) => r.data),
  verify: (v: VerifyRefundInput) => http.post<Refund>(`/refunds/${v.id}/verify`, {
    expectedVersion: v.expectedVersion,
    note: v.note || null,
  }, key(v.operationKey)).then((r) => r.data),
};
