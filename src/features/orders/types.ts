export type OrderStatus = 'Pending' | 'Approved' | 'Picking' | 'Shipped' | 'Delivering' | 'Delivered' | 'Completed' | 'Rejected' | 'Cancelled';
export type PaymentMethod = 'COD' | 'Prepaid' | 'Credit';

export interface OrderSummary {
  code: string;
  retailerCode: string;
  retailerName: string;
  itemsSummary: string;
  salesName: string;
  createdAt: string;
  channel: 'Online' | 'Offline';
  /** Final price after promotion. */
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  termDays: number | null;
}

/**
 * The MLOR the order froze, and where it came from. An Operator deciding whether to let an order
 * into the run needs both: a retailer rule for this SKU, a rule for its category and the product
 * default are different answers to "why that threshold", and only the first is the retailer's own.
 */
export interface OrderLineMlor {
  /**
   * The order side spells these `Sku` / `Category` / `Default` (SALES_ORDER_LINE.MlorSourceScope).
   * The allocation run side spells the same three `RetailerProduct` / `RetailerCategory` /
   * `ProductDefault`. Two vocabularies for one concept, so do not reuse either set on the other
   * screen: the label simply comes out blank.
   */
  sourceScope: 'Sku' | 'Category' | 'Default';
  minimumLifeRatio: number;
  minimumLifeHours: number | null;
  resolvedAt: string;
}

export interface OrderLine {
  no: number;
  sku: string;
  name: string;
  unitPrice: number;
  qty: number;
  promotionCode: string | null;
  promotionPct: number;
  discount: number;
  lineTotal: number;
  mlor: OrderLineMlor;
  /** True until the 12:00 run picks batches; the figure above is indicative, not what is charged. */
  finalPricePendingAllocation: boolean;
}
export interface OrderPromotion { no: number; code: string; name: string; detail: string; amount: number }

export interface AllocationRow {
  warehouseCode: string;
  warehouseName: string;
  sku: string;
  batchCode: string;
  expiry: string;
  km: number;
  eta: string;
  remainingDays: number;
  qty: number;
  score: number;
}

export interface DeliveryCost {
  parts: { warehouseCode: string; warehouseName: string; km: number; cost: number }[];
  total: number;
}
export interface DeliverySnapshot {
  plate: string;
  vehicleType: string;
  driverCode: string;
  driverName: string;
  driverPhone: string;
  departedAt: string;
}

export interface OrderDetail extends OrderSummary {
  /** The server identifier. Run-side endpoints (trace, price) are keyed by it, not by the code. */
  id: string;
  retailerAddress: string;
  groupCode: string;
  areaName: string;
  syncedAt: string | null;
  syncMode: string | null;
  prepaidChannel: 'QR' | 'Cash' | null;
  paymentStatus: string;
  receivable: { status: 'Unpaid' | 'Paid' | 'Overdue'; dueDate: string | null; outstanding: number; deliveredAt: string | null } | null;
  reviewer: string;
  rejectReason: string | null;
  cancelReason: string | null;
  promoChange: { localDiscount: number; officialDiscount: number; reason: string } | null;
  lines: OrderLine[];
  promotions: OrderPromotion[];
  totalBeforePromo: number;
  discount: number;
  finalPrice: number;
  totalQty: number;
  allocationState: 'Held' | 'Reserved' | 'Dispatched' | 'Released' | 'Failed';
  allocations: AllocationRow[];
  estimatedDeliveryCost: DeliveryCost | null;
  delivery: DeliverySnapshot | null;
  loyalty: { points: number; state: 'None' | 'AwaitingScan' | 'AwaitingPayment' | 'Earned' };
  pickingLists: { code: string; warehouseName: string }[];
  timeline: { at: string; label: string }[];
}

/** Allocation trace B1–B4 per order line (SPEC §5) – GET /orders/{code}/allocation-trace. */
/** Pool → Distance → Delivery: the hard filters, in the order the run applies them. */
export type TraceStage = 'Pool' | 'Distance' | 'Delivery';

export type TraceReason =
  | 'Eligible'
  | 'NoRemainingQuantity'
  | 'RouteUnavailable'
  | 'OutsideServiceRadius'
  | 'ArrivesAfterDeadline'
  | 'BelowMlor';

/** One batch as one filter saw it. Rejected batches are kept: "why not that one" is the question. */
export interface TraceCandidate {
  batchId: string;
  batchCode: string;
  warehouseId: string;
  warehouseCode: string;
  stage: TraceStage;
  passed: boolean;
  reason: TraceReason;
  /** Known from the Delivery stage on, where shelf life at arrival is worked out. */
  estimatedArrivalAt: string | null;
  remainingShelfLifeHours: number | null;
  requiredShelfLifeHours: number | null;
}

/**
 * One eligible batch as it was ranked in one greedy turn. The turn matters: coverage is recomputed
 * as the shortfall shrinks, so the same batch can score differently in turn one and turn two.
 */
export interface TraceScore {
  iteration: number;
  rank: number;
  batchId: string;
  batchCode: string;
  warehouseId: string;
  warehouseCode: string;
  remainingDemand: number;
  shelfLifeScore: number;
  distanceScore: number;
  coverageScore: number;
  weightedScore: number;
  selected: boolean;
  selectedQuantity: number;
}

export interface TraceWeights {
  shelfLife: number;
  distance: number;
  coverage: number;
  maximumDistanceMeters: number;
}

/**
 * Released is the one worth reading carefully: this line drew its stock, a later line of the same
 * order fell short, and because an order is all or nothing the draw went back to the shared pool
 * for the orders behind it. It is not the line that failed.
 */
export type TraceOutcome = 'Allocated' | 'Short' | 'Released';

export type MlorSource = 'RetailerProduct' | 'RetailerCategory' | 'ProductDefault';

export interface TraceLineDetail {
  salesOrderLineId: string;
  allocationRunLineId: string;
  sku: string;
  lineNumber: number;
  outcome: TraceOutcome;
  orderedQuantity: number;
  drawnQuantity: number;
  shortageQuantity: number;
  mlorSource: MlorSource;
  effectiveMlorRatio: number;
  totalShelfLifeHours: number;
  requiredShelfLifeHours: number;
  weights: TraceWeights;
  note: string | null;
  candidates: TraceCandidate[];
  scores: TraceScore[];
}

export interface OrderTraceDetail {
  salesOrderId: string;
  orderCode: string;
  allocationRunId: string;
  runCode: string;
  allocationPlanVersionId: string;
  planVersionNumber: number;
  planVersionStatus: string;
  /** False while the proposal is still awaiting a decision: a trace, not a settled outcome. */
  isApproved: boolean;
  lines: TraceLineDetail[];
}

export interface DispatchVehicle { plate: string; type: string; capacity: number; status: 'Active' | 'Maintenance' }
export interface DispatchDriver { code: string; name: string; phone: string; status: 'Active' | 'OnLeave' }
