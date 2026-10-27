export interface Complaint {
  id?: string;
  code: string; orderCode: string; retailerCode: string; retailerName: string;
  sku?: string; productName?: string; labelCode?: string | null;
  expectedQuantity?: number; actualQuantity?: number; issueType?: string;
  shipmentId?: string | null; allocationPlanPriceId?: string | null;
  finalUnitPrice?: number; adjustmentAmount?: number;
  content?: string; note?: string | null; evidenceUrl?: string | null;
  createdAt: string; status: 'Open' | 'Resolved'; result: string;
}
