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
  status: 'Open' | 'Approved' | 'Rejected' | 'Resolved';
  labelCode: string | null;
  note: string | null;
  evidenceUrl: string | null;
  createdAt: string;
  response: string | null;
  finalUnitPrice: number;
  adjustmentAmount: number;
}
