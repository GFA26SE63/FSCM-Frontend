import { useQuery } from '@tanstack/react-query';
import { getAll, http } from '@/shared/api/http';
import { useApiMutation } from '@/shared/hooks/useApiMutation';

export type RefundStatus = 'PendingRefund' | 'AwaitingVerification' | 'Refunded';

export interface Refund {
  id: string;
  salesOrderId: string;
  orderCode: string;
  amount: number;
  recipient: string;
  reason: string;
  status: RefundStatus;
  transferredAt: string | null;
  transactionReference: string | null;
  evidenceReference: string | null;
  verificationNote: string | null;
  version: number;
  createdAt: string;
}

const refundApi = {
  list: () => getAll<Refund>('/refunds'),
  create: (input: {
    salesOrderId: string;
    amount: number;
    recipient: string;
    reason: string;
    operationKey: string;
  }) => http.post<Refund>('/refunds', {
    salesOrderId: input.salesOrderId,
    amount: input.amount,
    recipient: input.recipient,
    reason: input.reason,
  }, { headers: { 'Idempotency-Key': input.operationKey } }).then((response) => response.data),
  evidence: (input: {
    id: string;
    expectedVersion: number;
    transferredAt: string;
    transactionReference: string;
    evidenceReference: string;
    operationKey: string;
  }) => http.post<Refund>(`/refunds/${input.id}/evidence`, {
    expectedVersion: input.expectedVersion,
    transferredAt: input.transferredAt,
    transactionReference: input.transactionReference,
    evidenceReference: input.evidenceReference,
  }, { headers: { 'Idempotency-Key': input.operationKey } }).then((response) => response.data),
  verify: (input: {
    id: string;
    expectedVersion: number;
    approved: boolean;
    note: string;
    operationKey: string;
  }) => http.post<Refund>(`/refunds/${input.id}/verify`, {
    expectedVersion: input.expectedVersion,
    approved: input.approved,
    note: input.note,
  }, { headers: { 'Idempotency-Key': input.operationKey } }).then((response) => response.data),
};

export const useRefunds = () => useQuery({ queryKey: ['refunds'], queryFn: refundApi.list });
export const useCreateRefund = () => useApiMutation(refundApi.create, { success: 'Đã tạo phiếu hoàn tiền.' });
export const useSubmitRefundEvidence = () => useApiMutation(refundApi.evidence, { success: 'Đã gửi bằng chứng hoàn tiền để Admin xác minh.' });
export const useVerifyRefund = () => useApiMutation(refundApi.verify, { success: 'Đã ghi nhận kết quả xác minh hoàn tiền.' });
