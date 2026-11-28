export type ReportKind =
  | 'financial'
  | 'receivables'
  | 'promotions'
  | 'loyalty'
  | 'claims'
  | 'fulfillment'
  | 'inventory-risk';

export interface PagedList<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// 1. Financial
export interface FinancialSummary {
  createdOrderCount: number;
  completedOrderCount: number;
  grossOrderValue: number;
  discountAmount: number;
  claimAdjustmentAmount: number;
  recognizedRevenue: number;
  collectedAmount: number;
  unappliedCreditAmount: number;
  refundedAmount: number;
  pendingRefundAmount: number;
  writeOffLossValue: number;
  writeOffIncluded: boolean;
  netCashflow: number;
}

export interface FinancialOrderItem {
  orderId: string;
  orderCode: string;
  createdAt: string;
  recognitionDate: string | null;
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  regionName: string;
  salesGroupCode: string;
  salesGroupName: string;
  salesUserName: string;
  status: string;
  paymentMethod: string | null;
  grossAmount: number;
  discountAmount: number;
  adjustmentAmount: number;
  netRecognizedAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

export interface FinancialReceiptItem {
  receiptId: string;
  receiptCode: string;
  confirmedAt: string | null;
  channel: string;
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  regionName: string;
  receivedAmount: number;
  allocatedAmount: number;
  unappliedCreditAmount: number;
  confirmedByName: string | null;
  reference: string | null;
  note: string | null;
}

export interface FinancialRefundItem {
  refundId: string;
  refundCode: string;
  orderId: string;
  orderCode: string;
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  regionName: string;
  amount: number;
  status: string;
  recipient: string;
  reason: string;
  createdAt: string;
  submittedByName: string | null;
  submittedAt: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  transactionReference: string | null;
}

export interface FinancialReportResult {
  fromDate: string;
  toDate: string;
  tab: string;
  scope: string;
  summary: FinancialSummary;
  orders: PagedList<FinancialOrderItem>;
  receipts: PagedList<FinancialReceiptItem>;
  refunds: PagedList<FinancialRefundItem>;
  notes: string[];
}

// 2. Receivables
export interface ReceivablesSummary {
  openInvoiceCount: number;
  settledInvoiceCount: number;
  debtorRetailerCount: number;
  totalReceivable: number;
  currentAmount: number;
  overdue1To7Amount: number;
  overdue8To30Amount: number;
  overdue31PlusAmount: number;
  totalOverdueAmount: number;
}

export interface ReceivablesAgingBucket {
  key: string;
  label: string;
  invoiceCount: number;
  amount: number;
}

export interface ReceivableInvoiceItem {
  paymentId: string;
  orderId: string;
  orderCode: string;
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  regionName: string;
  salesGroupCode: string;
  salesGroupName: string;
  salesUserName: string;
  orderCreatedAt: string;
  deliveredDate: string | null;
  dueDate: string | null;
  daysOverdue: number;
  agingBucket: string;
  adjustedAmount: number;
  confirmedAmount: number;
  outstandingAmount: number;
  paymentStatus: string;
  payOsLinkStatus: string | null;
  creditLimit: number;
  note: string | null;
}

export interface ReceivableCustomerItem {
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  regionName: string;
  salesGroupName: string;
  salesUserName: string;
  openInvoices: number;
  overdueInvoices: number;
  adjustedTotal: number;
  paidTotal: number;
  outstandingTotal: number;
  overdueTotal: number;
  maxDaysOverdue: number;
  creditLimit: number;
  creditTermDays: number;
  unappliedCreditAmount: number;
}

export interface ReceivablesReportResult {
  asOfDate: string;
  view: string;
  scope: string;
  summary: ReceivablesSummary;
  buckets: ReceivablesAgingBucket[];
  invoices: PagedList<ReceivableInvoiceItem>;
  customers: PagedList<ReceivableCustomerItem>;
  notes: string[];
}

// 3. Promotions
export interface PromotionsSummary {
  appliedOrderCount: number;
  completedOrderCount: number;
  totalQuantity: number;
  grossAmount: number;
  campaignDiscountAmount: number;
  shelfLifeDiscountAmount: number;
  totalDiscountAmount: number;
  netAmount: number;
  completedNetAmount: number;
  completedDiscountAmount: number;
  effectiveDiscountRatePercent: number;
}

export interface PromotionProgramSummary {
  programCode: string;
  programName: string;
  discountType: string;
  orderCount: number;
  completedOrderCount: number;
  totalQuantity: number;
  grossAmount: number;
  discountAmount: number;
  campaignDiscountAmount: number;
  shelfLifeDiscountAmount: number;
  netAmount: number;
  completedDiscountAmount: number;
  completedNetAmount: number;
  discountRatePercent: number;
}

export interface PromotionUsageItem {
  id: string;
  acceptedAt: string;
  orderId: string;
  orderCode: string;
  orderStatus: string;
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  regionName: string;
  discountType: string;
  programCode: string;
  programName: string;
  sku: string;
  productName: string;
  batchCode: string;
  quantity: number;
  listUnitPrice: number;
  grossAmount: number;
  campaignDiscountAmount: number;
  shelfLifeDiscountAmount: number;
  totalDiscountAmount: number;
  netAmount: number;
  explanation: string;
}

export interface PromotionsReportResult {
  fromDate: string;
  toDate: string;
  scope: string;
  summary: PromotionsSummary;
  byProgram: PromotionProgramSummary[];
  items: PagedList<PromotionUsageItem>;
  notes: string[];
}

// 4. Loyalty
export interface LoyaltyReportSummary {
  totalRedemptions: number;
  pendingRedemptions: number;
  completedRedemptions: number;
  overdueRedemptions: number;
  redeemedPointsCompleted: number;
  giftsDeliveredQuantity: number;
  periodEarnedPoints: number;
  periodUsedPoints: number;
  periodExpiredPoints: number;
  periodNetPointChange: number;
  currentAvailablePoints: number;
  currentHeldPoints: number;
  activeCardCount: number;
}

export interface LoyaltyRedemptionItem {
  id: string;
  createdAt: string;
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  regionName: string;
  programCode: string;
  programName: string;
  rewardCode: string;
  rewardName: string;
  quantity: number | null;
  redeemedPoints: number;
  status: string;
  orderId: string | null;
  orderCode: string | null;
  transactionId: string | null;
  createdByName: string | null;
  approvedByUserId: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  deliveredByName: string | null;
  deliveredAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  note: string | null;
}

export interface LoyaltyLedgerItem {
  id: string;
  createdAt: string;
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  regionName: string;
  programCode: string;
  programName: string;
  transactionType: string;
  points: number;
  balanceAfter: number;
  orderId: string | null;
  orderCode: string | null;
  createdByName: string | null;
  note: string | null;
}

export interface LoyaltyBalanceItem {
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  regionName: string;
  salesGroupName: string;
  currentPoints: number;
  heldPoints: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
  pendingRedemptionsCount: number;
  lastTransactionAt: string | null;
  earliestProgramExpiryAt: string | null;
}

export interface LoyaltyReportResult {
  fromDate: string;
  toDate: string;
  tab: string;
  scope: string;
  summary: LoyaltyReportSummary;
  redemptions: PagedList<LoyaltyRedemptionItem>;
  ledger: PagedList<LoyaltyLedgerItem>;
  balances: PagedList<LoyaltyBalanceItem>;
  notes: string[];
}

// 5. Claims
export interface ClaimsSummary {
  totalClaims: number;
  openClaims: number;
  resolvedClaims: number;
  physicalCollectionPendingCount: number;
  averageResolutionHours: number;
  requestedQuantity: number;
  approvedQuantity: number;
  totalDebtOffsetAmount: number;
  totalRefundAmount: number;
  completedRefundAmount: number;
}

export interface ClaimsWarehouseBreakdown {
  warehouseCode: string;
  warehouseName: string;
  claimCount: number;
  openCount: number;
  approvedQuantity: number;
  financialImpactAmount: number;
}

export interface ClaimReportItem {
  id: string;
  claimCode: string;
  reportedAt: string;
  orderId: string;
  orderCode: string;
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  regionName: string;
  salesGroupName: string;
  salesUserName: string;
  warehouseCode: string;
  warehouseName: string;
  requestType: string;
  settlementMethod: string;
  resolutionType: string;
  status: string;
  requestedQuantity: number;
  approvedQuantity: number | null;
  handledQuantity: number | null;
  requiresCollection: boolean;
  physicalHandlingCompleted: boolean;
  financialAdjustmentApplied: boolean;
  debtOffsetAmount: number;
  refundAmount: number;
  refundId: string | null;
  refundCode: string | null;
  refundStatus: string | null;
  returnDocCode: string | null;
  returnDocStatus: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  resolvedAt: string | null;
  resolutionHours: number | null;
  note: string | null;
}

export interface ClaimsReportResult {
  fromDate: string;
  toDate: string;
  scope: string;
  summary: ClaimsSummary;
  byWarehouse: ClaimsWarehouseBreakdown[];
  items: PagedList<ClaimReportItem>;
  notes: string[];
}

// 6. Fulfillment
export interface FulfillmentSummary {
  shipmentCount: number;
  deliveredShipmentCount: number;
  exceptionShipmentCount: number;
  fillRatePercent: number;
  onTimeRatePercent: number;
  shortageCartons: number;
  goodsReceiptCount: number | null;
  goodsReceiptCartons: number | null;
  pickingCount: number | null;
  pickingExceptionCount: number | null;
  transferCount: number | null;
  transferInTransitCount: number | null;
}

export interface FulfillmentShipmentItem {
  shipmentId: string;
  shipmentCode: string;
  orderId: string;
  orderCode: string;
  warehouseCode: string;
  warehouseName: string;
  retailerCode: string;
  retailerName: string;
  driverName: string | null;
  plateNumber: string | null;
  status: string;
  totalQuantity: number;
  receivedQuantity: number;
  shortageQuantity: number;
  readyAt: string | null;
  issuedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  estimatedArrivalAt: string | null;
  isOnTime: boolean | null;
  transitHours: number | null;
  exceptionReason: string | null;
}

export interface FulfillmentDriverItem {
  driverId: string;
  driverCode: string;
  driverName: string;
  plateNumber: string;
  warehouseCode: string;
  tripCount: number;
  completedTrips: number;
  exceptionTrips: number;
  onTimeTrips: number;
  totalCartons: number;
  receivedCartons: number;
  fillRatePercent: number;
  onTimeRatePercent: number;
}

export interface FulfillmentInboundItem {
  documentId: string;
  documentCode: string;
  sourceType: string;
  createdAt: string;
  completedAt: string | null;
  warehouseCode: string;
  warehouseName: string;
  regionName: string;
  lineCount: number;
  receivedQuantity: number;
  status: string;
  leadTimeHours: number | null;
  createdByName: string | null;
  note: string | null;
}

export interface FulfillmentPickingItem {
  pickingId: string;
  pickingCode: string;
  orderId: string;
  orderCode: string;
  warehouseCode: string;
  warehouseName: string;
  status: string;
  lineCount: number;
  requestedQuantity: number;
  pickedQuantity: number;
  createdAt: string;
  startedAt: string | null;
  confirmedAt: string | null;
  pickingMinutes: number | null;
  assigneeName: string | null;
  confirmedByName: string | null;
}

export interface FulfillmentTransferItem {
  transferId: string;
  transferCode: string;
  sourceWarehouseCode: string;
  sourceWarehouseName: string;
  destinationWarehouseCode: string;
  destinationWarehouseName: string;
  status: string;
  driverName: string | null;
  plateNumber: string | null;
  requestedQuantity: number;
  dispatchedQuantity: number;
  receivedQuantity: number;
  requestedAt: string;
  dispatchedAt: string | null;
  receivedAt: string | null;
  inTransitHours: number | null;
  note: string | null;
}

export interface FulfillmentReportResult {
  fromDate: string;
  toDate: string;
  tab: string;
  scope: string;
  summary: FulfillmentSummary;
  shipments: PagedList<FulfillmentShipmentItem>;
  drivers: PagedList<FulfillmentDriverItem>;
  inbound: PagedList<FulfillmentInboundItem>;
  picking: PagedList<FulfillmentPickingItem>;
  transfers: PagedList<FulfillmentTransferItem>;
  notes: string[];
}

// 7. Inventory Risk
export interface InventoryRiskSummary {
  nearExpiryBatchCount: number;
  nearExpiryCartons: number;
  expiredUnsoldBatchCount: number;
  expiredUnsoldCartons: number;
  estimatedExpiryRiskValue: number;
  activeLockCount: number;
  activeLockedCartons: number;
  locksRequiringResolutionCount: number;
  estimatedLockedValue: number;
  writeOffDocCount: number;
  disposedCartonsInPeriod: number;
  estimatedWriteOffLossValue: number;
}

export interface ExpiryActionBatchItem {
  batchId: string;
  batchCode: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  regionName: string;
  sku: string;
  productName: string;
  productionDate: string;
  expirationDate: string;
  daysUntilExpiry: number;
  expiryStatus: string;
  physicalQuantity: number;
  reservedQuantity: number;
  lockedQuantity: number;
  availableQuantity: number;
  hasActiveBatchPromo: boolean;
  unitPrice: number;
  estimatedAtRiskValue: number;
}

export interface InventoryLockReportItem {
  lockId: string;
  warehouseCode: string;
  warehouseName: string;
  regionName: string;
  batchCode: string;
  sku: string;
  productName: string;
  expirationDate: string;
  lockedQuantity: number;
  reason: string;
  requiresResolution: boolean;
  status: string;
  daysOpen: number;
  lockedByName: string | null;
  releasedByName: string | null;
  createdAt: string;
  releasedAt: string | null;
  estimatedValue: number;
  note: string | null;
}

export interface DisposalReportItem {
  lineId: string;
  writeOffId: string;
  writeOffCode: string;
  createdAt: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  regionName: string;
  batchCode: string;
  sku: string;
  productName: string;
  expirationDate: string | null;
  quantity: number;
  unitPriceAtWriteOff: number;
  lossAmount: number;
  disposalMethod: string;
  createdByName: string | null;
  note: string | null;
}

export interface InventoryRiskReportResult {
  fromDate: string;
  toDate: string;
  tab: string;
  scope: string;
  summary: InventoryRiskSummary;
  expiry: PagedList<ExpiryActionBatchItem>;
  locks: PagedList<InventoryLockReportItem>;
  disposals: PagedList<DisposalReportItem>;
  notes: string[];
}
