import { get, http } from '@/shared/api/http';
import { graphql } from '@/shared/api/graphql';
import type { Refund, RefundEvidenceFile, RefundObligation } from './types';

const withKey = (operationKey: string) => ({ headers: { 'Idempotency-Key': operationKey } });

export const refundApi = {
  list: (params?: { orderId?: string; status?: string }) => graphql<{ entities: { refundReads: Refund[] } }>(`query RefundReads($orderId: UUID, $status: String) { entities { refundReads(orderId: $orderId, status: $status) { id paymentId salesOrderId orderCode amount recipient reason status transferredAt transactionReference evidenceReference createdByUserId submittedByUserId submittedAt verifiedByUserId verifiedAt verificationNote version finalApprovedAmount adjustedAmount confirmedAmount pendingRefundAmount refundedAmount refundDueAmount receiptDiscrepancyId createdAt updatedAt } } }`, { orderId: params?.orderId, status: params?.status }).then(x => x.entities.refundReads),
  get: (id: string) => get<Refund>(`/refunds/${id}`),
  obligations: () => get<RefundObligation[]>('/refunds/obligations'),
  create: (input: {
    salesOrderId: string;
    amount: number;
    recipient: string;
    reason: string;
    receiptDiscrepancyId?: string | null;
    operationKey: string;
  }) =>
    http
      .post<Refund>(
        '/refunds',
        {
          salesOrderId: input.salesOrderId,
          amount: input.amount,
          recipient: input.recipient,
          reason: input.reason,
          receiptDiscrepancyId: input.receiptDiscrepancyId ?? null,
        },
        withKey(input.operationKey),
      )
      .then((response) => response.data),
  /** Uploads one proof image (JPG/PNG/WebP, up to 10 MB) and returns the reference to submit. */
  uploadEvidence: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    // The shared client defaults to application/json, which makes axios turn FormData into JSON and
    // the server never sees the file. Multipart lets the browser add the boundary itself.
    return http
      .post<RefundEvidenceFile>('/refunds/evidence-files', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000,
      })
      .then((response) => response.data);
  },
  evidenceUrl: (reference: string) =>
    get<{ url: string | null }>('/refunds/evidence-files/url', { reference }).then((result) => result.url),
  submitEvidence: (input: {
    id: string;
    expectedVersion: number;
    transferredAt: string;
    transactionReference: string;
    evidenceReference: string;
    operationKey: string;
  }) =>
    http
      .post<Refund>(
        `/refunds/${input.id}/evidence`,
        {
          expectedVersion: input.expectedVersion,
          transferredAt: input.transferredAt,
          transactionReference: input.transactionReference,
          evidenceReference: input.evidenceReference,
        },
        withKey(input.operationKey),
      )
      .then((response) => response.data),
  verify: (input: {
    id: string;
    expectedVersion: number;
    approved: boolean;
    note: string;
    operationKey: string;
  }) =>
    http
      .post<Refund>(
        `/refunds/${input.id}/verify`,
        { expectedVersion: input.expectedVersion, approved: input.approved, note: input.note },
        withKey(input.operationKey),
      )
      .then((response) => response.data),
};
