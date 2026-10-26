/** Weights and service radius frozen for one run, so a later config change cannot move a plan. */
export interface AllocationSettings {
  shelfLifeWeight: number;
  distanceWeight: number;
  coverageWeight: number;
  maxServingDistanceMeters: number;
}

export type RunStatus = 'Snapshotted' | 'Planning' | 'AwaitingApproval' | 'Approved' | 'Closed' | 'Failed';

export type RunOrderStatus = 'Pending' | 'Fulfilled' | 'Short';

export type MlorSource = 'RetailerProduct' | 'RetailerCategory' | 'ProductDefault';

export interface RunLine {
  id: string;
  salesOrderLineId: string;
  productId: string;
  sku: string;
  lineNumber: number;
  orderedQuantity: number;
  totalShelfLifeHours: number;
  effectiveMlorRatio: number;
  mlorSource: MlorSource;
  baseNetUnitPrice: number;
  allocatedQuantity: number;
}

export interface RunOrder {
  id: string;
  salesOrderId: string;
  orderCode: string;
  retailerId: string;
  acceptedAt: string;
  deliveryDeadline: string | null;
  /** Lower goes first: server-received time, then order code. An earlier order is never moved aside. */
  priorityRank: number;
  status: RunOrderStatus;
  shortageReason: string | null;
  lines: RunLine[];
}

export interface AllocationRun {
  id: string;
  runCode: string;
  businessDate: string;
  cutoffAt: string;
  status: RunStatus;
  settings: AllocationSettings;
  transitTableVersion: number;
  etaScheduleVersion: number;
  orderCount: number;
  failureReason: string | null;
  startedAt: string;
  snapshotCompletedAt: string | null;
  completedAt: string | null;
  version: number;
  orders: RunOrder[];
}

/** One allocated part: which batch, when it arrives, how much life it has left then. */
export interface PlanAllocation {
  allocationRunLineId: string;
  batchId: string;
  batchCode: string;
  warehouseId: string;
  warehouseCode: string;
  quantity: number;
  sequence: number;
  estimatedArrivalAt: string;
  remainingShelfLifeHours: number;
  weightedScore: number;
}

/** The price of that same part. Keyed alike, so choice and price read side by side. */
export interface PlanPrice {
  allocationRunLineId: string;
  batchId: string;
  warehouseId: string;
  quantity: number;
  baseNetUnitPrice: number;
  remainingShelfLifePercent: number;
  shelfLifeDiscountTierId: string | null;
  discountType: 'Percent' | 'FixedPerUnit' | null;
  discountValue: number | null;
  shelfLifeDiscountPerUnit: number;
  finalNetUnitPrice: number;
  amount: number;
  discountTableVersion: number;
  explanation: string;
}

export type PlanVersionStatus =
  | 'AwaitingApproval'
  | 'Approved'
  | 'RecalculationRequested'
  | 'Superseded';

export interface PlanVersion {
  id: string;
  allocationRunId: string;
  runCode: string;
  versionNumber: number;
  status: PlanVersionStatus;
  /** The one moment the whole version was priced from. */
  pricedAt: string;
  fulfilledOrderCount: number;
  shortOrderCount: number;
  totalFinalAmount: number;
  approvedByUserId: string | null;
  approvedAt: string | null;
  recalculationReason: string | null;
  version: number;
  prices: PlanPrice[];
  allocations: PlanAllocation[];
}
