export type OrderStatus =
  | 'PendingApproval'
  | 'PendingAllocation'
  | 'Approved'
  | 'Picking'
  | 'Rejected'
  | 'Cancelled'
  | 'Issued'
  | 'Delivering'
  | 'Delivered';
export type PaymentMethod = 'COD' | 'Prepaid' | 'Credit';

export interface OrderSummary {
  id: string;
  orderCode: string;
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  salesGroupId: string;
  createdByUserId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  finalAmount: number;
  indicativeAmount: number;
  officialAmount: number | null;
  finalPricePendingAllocation: boolean;
  allocationState: string;
  allocationRunId: string | null;
  allocationProposalStatus: string | null;
  allocationResult: string | null;
  shipmentCount: number;
  totalCartons: number;
  lineCount: number;
  source: 'Assisted' | 'Offline';
  version: number;
  createdAt: string;
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
  sourceRuleId: string | null;
  sourceVersion: number;
  productCategoryId: string | null;
  minimumLifeRatio: number;
  minimumLifeHours: number | null;
  resolvedAt: string;
}

export interface OrderLine {
  id: string;
  lineNumber: number;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  discountPercent: number;
  discountAmount: number;
  netAmount: number;
  discountSourceType: string | null;
  discountSourceCode: string | null;
  productPriceId: string;
  productPriceEffectiveFrom: string;
  productPriceEffectiveTo: string | null;
  pricedAt: string;
  mlor: OrderLineMlor;
  ordinaryPromotion: {
    promotionId: string;
    code: string;
    name: string;
    type: string;
    minimumQuantity: number;
    discountPercent: number;
    discountAmount: number;
    effectiveFrom: string;
    effectiveTo: string;
    appliedAt: string;
  } | null;
  estimatedArrivalAt: string | null;
  /** True until the 12:00 run picks batches; the figure above is indicative, not what is charged. */
  finalPricePendingAllocation: boolean;
  baseUnitPrice: number;
  ordinaryPromotionDiscountAmount: number;
  indicativeNetAmount: number;
  officialNetAmount: number | null;
  allocationFragments: OrderAllocationFragment[];
}
export interface OrderAllocationFragment {
  allocationId: string;
  planPriceId: string;
  batchId: string;
  batchCode: string;
  batchExpirationDate: string;
  warehouseId: string;
  warehouseCode: string;
  quantity: number;
  sequence: number;
  estimatedArrivalAt: string;
  remainingLifeHoursAtArrival: number;
  listUnitPrice: number;
  ordinaryPromotionDiscountPerUnit: number;
  baseUnitPrice: number;
  remainingShelfLifePercent: number;
  discountRuleId: string | null;
  discountRuleScope: string | null;
  discountRuleCode: string | null;
  discountRuleVersion: number;
  discountType: string | null;
  discountValue: number | null;
  shelfLifeDiscountPerUnit: number;
  finalUnitPrice: number;
  netAmount: number;
  discountReason: string;
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
  reviewedByUserId: string | null;
  creditTermDays: number;
  deliveryAddress: string;
  requestedDeliveryDate: string | null;
  note: string | null;
  subtotalAmount: number;
  discountAmount: number;
  rejectionReason: string | null;
  offlineEstimatedAmount: number | null;
  hasOfflineDifference: boolean;
  serverReceivedAt: string;
  updatedAt: string;
  lines: OrderLine[];
  history: { fromStatus: string | null; toStatus: string; reason: string | null; changedByUserId: string; changedAt: string }[];
  shipments: { id: string; status: string; dispatchedAt: string | null; deliveredAt: string | null }[];
  allocationRunCode: string | null;
  allocationPlanVersion: number | null;
  officialPricedAt: string | null;
  warehouseProgress: {
    warehouseId: string;
    warehouseCode: string;
    pickingListId: string | null;
    pickingCode: string | null;
    pickingStatus: string | null;
    shipmentId: string | null;
    shipmentCode: string | null;
    shipmentStatus: string | null;
    plannedQuantity: number;
    pickedQuantity: number;
    receivedQuantity: number;
  }[];
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

/** Bản giá bất biến của một đơn sau phân bổ (F98) — GET /allocation-runs/orders/{id}/price. */
export interface OrderPricePart {
  batchId: string;
  batchCode: string;
  warehouseId: string;
  quantity: number;
  listUnitPrice: number;
  baseNetUnitPrice: number;
  pricedAt: string;
  batchExpiresAt: string;
  totalShelfLifeHours: number;
  remainingShelfLifePercent: number;
  discountType: string | null;
  discountValue: number | null;
  shelfLifeDiscountPerUnit: number;
  finalNetUnitPrice: number;
  amount: number;
  explanation: string;
}

export interface OrderPriceLine {
  sku: string;
  lineNumber: number;
  orderedQuantity: number;
  allocatedQuantity: number;
  baseAmount: number;
  shelfLifeDiscountAmount: number;
  finalAmount: number;
  parts: OrderPricePart[];
}

export interface OrderPrice {
  salesOrderId: string;
  orderCode: string;
  runCode: string;
  planVersionNumber: number;
  planVersionStatus: string;
  /** False khi phương án còn chờ duyệt: đây là báo giá, chưa phải giá đã chốt. */
  isApproved: boolean;
  pricedAt: string;
  baseAmount: number;
  shelfLifeDiscountAmount: number;
  finalAmount: number;
  lines: OrderPriceLine[];
}

export interface DispatchVehicle { plate: string; type: string; capacity: number; status: 'Active' | 'Maintenance' }
export interface DispatchDriver { code: string; name: string; phone: string; status: 'Active' | 'OnLeave' }
