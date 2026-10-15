export type RotationStatus = 'Proposed' | 'Approved' | 'Skipped' | 'DiscountSuggested' | 'NoDestination';

export interface RotationProposal {
  id: string;
  batchCode: string;
  sku: string;
  productName: string;
  fromWarehouseCode: string;
  fromWarehouseName: string;
  excess: number;
  expiry: string;
  runDate: string;
  toWarehouseCode: string | null;
  toWarehouseName: string | null;
  km: number;
  qty: number;
  maxQty: number;
  score: number;
  salvage: number;
  tripCost: number;
  status: RotationStatus;
  transferCode: string | null;
}
export interface ProposalList { runDate: string; jobRanAt: string; items: RotationProposal[] }

/** Step 1 – sellable capacity per customer group: v · (L − m·SL − 1). */
export interface Step1Row { group: string; velocity: number; m: number; mlorDays: number; windowDays: number; sellable: number }
/** Step 2 – destination candidates with hard filters (accepted or rejected with reason). */
export interface Step2Row {
  warehouseCode: string; warehouseName: string; km: number; transitDays: number | null; remainingAtDest: number | null; salesCapacity: number | null;
  qAhead: number; receivingCapacity: number | null; accepted: boolean; reason: string;
}
export interface Step3Row { warehouseName: string; tentativeQty: number; fE: number; fD: number; fQ: number; score: number }
export interface Step4Row { turn: number; warehouseName: string; excessLeft: number; qty: number; after: number; note: string }

export interface RotationTrace {
  batchCode: string; sku: string; productName: string; shelfLifeDays: number; fromWarehouseName: string; expiry: string; remainingDays: number;
  quantity: number; olderAhead: number; sellable: number; excess: number; unitCost: number;
  weights: { wE: number; wD: number; wQ: number }; minQty: number; roundTo: number; leftover: number;
  step1: Step1Row[]; step2: Step2Row[]; step3: Step3Row[]; step4: Step4Row[];
}
export interface ProposalDetail { proposal: RotationProposal; trace: RotationTrace }
export interface RunResult { runDate: string; batchesWithExcess: number; proposals: number }
