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
  issueType: 'Shortage' | 'Damaged';
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
}
