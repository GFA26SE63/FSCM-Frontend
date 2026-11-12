export interface ComplaintEvidence {
  id: string;
  fileName: string;
  contentType: string;
  /** Short-lived read URL (SAS). */
  url: string;
  uploadedAt: string;
}

export interface Complaint {
  id: string;
  code: string;
  salesOrderId: string;
  orderCode: string;
  retailerCode: string;
  retailerName: string;
  sku: string;
  productName: string;
  expectedQuantity: number;
  actualQuantity: number;
  issueType: 'Shortage' | 'Damaged' | 'Return';
  status: 'Open' | 'Approved' | 'Rejected' | 'Resolved' | 'Cancelled';
  /** Raw backend status: Submitted | UnderReview | Approved | Rejected | Resolved. */
  reviewStatus?: 'Submitted' | 'UnderReview' | 'Approved' | 'Rejected' | 'Resolved' | 'Cancelled';
  /** Set once Admin approves: claims are settled in money (FinancialAdjustment). */
  resolutionType?: 'FinancialAdjustment' | null;
  /** Latest reason Admin/Operator asked the retailer for more evidence. */
  evidenceRequestReason?: string | null;
  labelCode: string | null;
  note: string | null;
  evidenceUrl: string | null;
  createdAt: string;
  response: string | null;
  finalUnitPrice: number;
  adjustmentAmount: number;
  requestType?: 'Complaint' | 'Return' | 'DamagedCollection';
  settlementMethod?: 'DebtOffset' | 'CashRefund' | 'None';
  approvedSettlementMethod?: 'DebtOffset' | 'CashRefund' | 'None' | null;
  requestedQuantity?: number;
  approvedQuantity?: number | null;
  handledQuantity?: number | null;
  requiresCollection?: boolean;
  physicalHandlingCompleted?: boolean;
  financialAdjustmentApplied?: boolean;
  debtOffsetAmount?: number;
  refundAmount?: number;
  refundId?: string | null;
  version?: number;
  documents?: {id: string; code: string; kind: 'ReturnOrder' | 'CollectionOrder'; status: 'Pending' | 'Completed' | 'Waived';
    approvedQuantity: number; actualQuantity: number | null; completedAt: string | null; note: string | null; evidenceReference: string | null}[];
}

export const requestTypeLabel = (type?: string) => type === 'Return' ? 'Trả hàng' : type === 'DamagedCollection' ? 'Thu hồi hàng hỏng' : 'Khiếu nại đơn hàng';
export const settlementLabel = (method?: string | null) => method === 'CashRefund' ? 'Hoàn tiền' : method === 'None' ? 'Thu hồi, không bồi hoàn' : 'Cấn trừ công nợ';
