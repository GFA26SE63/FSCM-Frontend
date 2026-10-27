export type RefundStatus = 'PendingRefund' | 'AwaitingVerification' | 'Refunded';

export interface Refund {
  id: string;
  paymentId: string;
  salesOrderId: string;
  orderCode: string;
  amount: number;
  recipient: string;
  reason: string;
  status: RefundStatus;
  transferredAt?: string | null;
  transactionReference?: string | null;
  evidenceReference?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRefundInput {
  salesOrderId: string;
  amount: number;
  recipient: string;
  reason: string;
  operationKey: string;
}

export interface RefundEvidenceInput {
  id: string;
  expectedVersion: number;
  transferredAt: string;
  transactionReference: string;
  evidenceReference: string;
  operationKey: string;
}

export interface VerifyRefundInput {
  id: string;
  expectedVersion: number;
  note: string;
  operationKey: string;
}
