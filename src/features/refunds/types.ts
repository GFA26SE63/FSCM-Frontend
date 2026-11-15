/**
 * F101: manual refund records.
 *
 * A record only says money is owed back. The money has really moved only when the status is
 * `Refunded`, which an Admin sets after checking the transfer proof. Creating a record, approving a
 * complaint or submitting proof never counts as a transfer.
 */
export type RefundStatus = 'PendingRefund' | 'AwaitingVerification' | 'EvidenceRejected' | 'Refunded';

export interface Refund {
  id: string;
  paymentId: string;
  salesOrderId: string;
  orderCode: string;
  amount: number;
  recipient: string;
  reason: string;
  status: RefundStatus;
  transferredAt: string | null;
  transactionReference: string | null;
  /** `blob:<key>` for an uploaded proof image, otherwise a free text reference. */
  evidenceReference: string | null;
  createdByUserId: string;
  submittedByUserId: string | null;
  submittedAt: string | null;
  verifiedByUserId: string | null;
  verifiedAt: string | null;
  verificationNote: string | null;
  version: number;
  finalApprovedAmount: number;
  adjustedAmount: number;
  confirmedAmount: number;
  pendingRefundAmount: number;
  refundedAmount: number;
  refundDueAmount: number;
  receiptDiscrepancyId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A payment that collected more than it is now owed and has no refund record for the difference. */
export interface RefundObligation {
  paymentId: string;
  salesOrderId: string;
  orderCode: string;
  retailerName: string;
  confirmedAmount: number;
  adjustedAmount: number;
  refundedAmount: number;
  pendingRefundAmount: number;
  unrequestedAmount: number;
  claimIds: string[];
}

export interface RefundEvidenceFile {
  reference: string;
  fileName: string;
  readUrl: string;
}

export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  PendingRefund: 'Chờ hoàn',
  AwaitingVerification: 'Chờ Admin xác minh',
  EvidenceRejected: 'Bằng chứng bị trả lại',
  Refunded: 'Đã hoàn',
};

/** Statuses where the obligation is still open and nothing has been verified as transferred. */
export const OPEN_REFUND_STATUSES: RefundStatus[] = ['PendingRefund', 'AwaitingVerification', 'EvidenceRejected'];
