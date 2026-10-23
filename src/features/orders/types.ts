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
export interface TraceLine {
  sku: string;
  productName: string;
  qty: number;
  shelfLifeDays: number;
  m: number;
  mlorDays: number;
  b1: { warehouseName: string; batchCode: string; expiry: string; available: number; heldBefore: number; kept: boolean; reason: string }[];
  b2a: { warehouseName: string; batchCode: string; km: number; kept: boolean; reason: string }[];
  b2d: { warehouseName: string; batchCode: string; transitDays: number; eta: string; expiry: string; remainingDays: number; kept: boolean; reason: string }[];
  b3: { rank: number; warehouseName: string; batchCode: string; remainingDays: number; fE: number; fD: number; fQ: number; score: number }[];
  b4: { turn: number | null; warehouseName: string; batchCode: string; available: number; need: number; fQ: number | null; score: number | null; take: number; left: number }[];
  enough: boolean;
  allocated: number;
  short: number;
  allocations: AllocationRow[];
}
export interface AllocationTrace {
  orderCode: string;
  retailerCode: string;
  retailerName: string;
  basis: string;
  dispatchDate: string;
  dmaxRetailerKm: number;
  weights: { wE: number; wD: number; wQ: number };
  ok: boolean;
  dispatched: boolean;
  lines: TraceLine[];
  estimatedDeliveryCost: DeliveryCost | null;
}

export interface DispatchVehicle { plate: string; type: string; capacity: number; status: 'Active' | 'Maintenance' }
export interface DispatchDriver { code: string; name: string; phone: string; status: 'Active' | 'OnLeave' }
