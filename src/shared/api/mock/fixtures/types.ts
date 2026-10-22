/** Internal shape of the in-memory mock database. Handlers map these rows to the REST DTOs of SPEC §8. */
export type Iso = string; // "yyyy-MM-dd" or "yyyy-MM-ddTHH:mm"

export type OrderStatus = 'Pending' | 'Approved' | 'Picking' | 'Shipped' | 'Delivering' | 'Delivered' | 'Completed' | 'Rejected' | 'Cancelled';

export interface DbCategory { code: string; name: string; description: string; status: 'Active' | 'Inactive' }

export interface DbProduct {
  sku: string; name: string; categoryCode: string; packSpec: string; basePrice: number; unitCost: number;
  shelfLifeDays: number; nearExpiryDays: number; defaultMlor: number;
  status: 'Draft' | 'Published' | 'Inactive'; replaceOf: string | null; replacedBy: string | null;
}

export interface DbWarehouse {
  code: string; name: string; address: string; lat: number; lng: number; type: 'Central' | 'Regional';
  keeperName: string | null; capacityPallets: number; status: 'Active' | 'Paused';
}

export interface DbArea { code: string; name: string; region: string; managerName: string; wards: string[] }
export interface DbSalesGroup { code: string; areaCode: string; managerName: string; members: string[] }

export interface DbRetailer {
  code: string; name: string; address: string; phone: string; contact: string; areaCode: string; groupCode: string;
  lat: number; lng: number; status: 'Active' | 'Locked'; source: string;
  kind: string; size: 'S' | 'M' | 'L'; areaM2: number; fridges: number; forecastRevenue: number; monthlyCapacity: number; orderFrequency: string;
  potentialClass: 'A' | 'B' | 'C'; creditTermDays: 0 | 7 | 14 | 30;
}

export interface DbRegistration {
  code: string; name: string; address: string; phone: string; contact: string; areaCode: string; kind: string; size: 'S' | 'M' | 'L';
  forecastRevenue: number; monthlyCapacity: number; salesName: string; createdAt: Iso;
  status: 'Pending' | 'Approved' | 'Rejected'; retailerCode: string | null; rejectReason: string | null;
}

export interface DbBatch { code: string; warehouseCode: string; sku: string; expiry: Iso; available: number; held: number; disposed: boolean; manufacturerLot: string }

export interface DbReceipt {
  code: string; warehouseCode: string; receivedAt: Iso; receivedBy: string; note: string;
  lines: { sku: string; batchCode: string; expiry: Iso; qty: number; labels: number; lot: string }[];
}
export interface DbDisposal {
  code: string; warehouseCode: string; createdAt: Iso; createdBy: string; reason: string; method: 'Tiêu hủy tại kho' | 'Trả nhà cung cấp';
  lines: { sku: string; batchCode: string; expiry: Iso; qty: number }[];
}
export interface DbTransfer {
  code: string; kind: 'Replenishment' | 'NearExpiryRotation'; fromWarehouse: string; toWarehouse: string; sku: string; sourceBatch: string; expiry: Iso;
  qty: number; createdAt: Iso; createdBy: string; status: 'InTransit' | 'Received' | 'Cancelled'; labelCode: string; receivedNote: string; score: number | null; note: string;
}

export interface DbVehicle { plate: string; type: string; capacity: number; warehouseCode: string; status: 'Active' | 'Maintenance' }
export interface DbDriver { code: string; name: string; phone: string; licenseClass: string; status: 'Active' | 'OnLeave' }

export interface DbDelivery { plate: string; vehicleType: string; driverCode: string; driverName: string; driverPhone: string; departedAt: Iso }
export interface DbCredit { termDays: number; deliveredAt: Iso | null; dueDate: Iso | null; paid: boolean; paidAt: Iso | null; collectedBy: string | null; method: 'Cash' | 'Transfer' | null }

export interface DbOrder {
  code: string; retailerCode: string; lines: { sku: string; qty: number }[]; status: OrderStatus; createdAt: Iso; salesName: string;
  channel: 'Online' | 'Offline'; syncedAt: Iso | null; syncMode: string | null; promoChanged: boolean; localDiscount: number;
  paymentMethod: 'COD' | 'Prepaid' | 'Credit'; prepaidChannel: 'QR' | 'Cash' | null; termDays: number | null; paidNote: string;
  reason: string; reviewer: string; promoIds: string[]; heldBefore: Record<string, number>;
  delivery: DbDelivery | null; credit: DbCredit | null; archived: boolean; timeline: { at: Iso; label: string }[];
}

export interface DbPromotion {
  code: string; name: string; type: 'PerSku' | 'Group'; validFrom: Iso; validTo: Iso; retailerCodes: string[] | null;
  status: 'Running' | 'Paused' | 'Ended';
  rules: { sku: string; minQty: number; discountPct: number }[]; groupSkus: string[]; groupMinQty: number; groupDiscountPct: number;
}
export interface DbBatchDiscount { code: string; batchCode: string; discountPct: number; validFrom: Iso; validTo: Iso; createdBy: string; status: 'Active' | 'Ended' }

export interface DbLedgerEntry { date: Iso; description: string; kind: 'Earned' | 'Pending' | 'Redeemed' | 'Refunded'; points: number | null }
export interface DbLoyaltyAccount { retailerCode: string; balance: number; ledger: DbLedgerEntry[] }
export interface DbGift { code: string; name: string; points: number; stock: number; redeemed: number; status: 'Active' | 'Paused' }
export interface DbRedemption {
  code: string; retailerCode: string; giftCode: string; points: number; requestedAt: Iso;
  status: 'Requested' | 'Approved' | 'Delivered' | 'Done' | 'Rejected'; handledNote: string;
}
export interface DbLoyaltyProgram { code: string; name: string; scope: string; validFrom: Iso; validTo: Iso; pointsExpireOn: Iso; status: 'Running' | 'Paused' }

export interface DbComplaint { code: string; orderCode: string; retailerCode: string; content: string; createdAt: Iso; status: 'Open' | 'Resolved'; result: string }
export interface DbUser { id: string; name: string; loginName: string; role: string; scope: string; status: 'Active' | 'Locked'; lastLoginAt: Iso | null }
export interface DbKpiRow { name: string; group: string; before: number; after: number; orders: number; stores: number; newStores: number; target: number }
export interface DbNotification { id: string; title: string; body: string; createdAt: Iso; read: boolean; link: string | null }

export interface TransitBand { fromKm: number; toKm: number; days: number; cost: number; scope: 'RetailerAndWarehouse' | 'WarehouseOnly' }

/** Shared transit table version (F54). Distances in metres, durations in minutes, as the backend stores them. */
export interface DbTransitTable {
  id: string;
  version: number;
  maxServingDistanceMeters: number;
  effectiveFrom: Iso;
  effectiveTo: Iso | null;
  isActive: boolean;
  note: string | null;
  createdByUserId: string;
  createdAt: Iso;
  updatedAt: Iso;
  bands: {
    id: string;
    minDistanceMeters: number;
    maxDistanceMeters: number;
    handlingMinutes: number;
    transitMinutes: number;
    estimatedCostAmount: number;
  }[];
}
export interface DbSettings {
  allocation: { wE: number; wD: number; wQ: number };
  dmaxRetailerKm: number; dmaxWarehouseKm: number;
  rotation: { wE: number; wD: number; wQ: number; velocityDays: number; minQty: number; roundTo: number };
  minRegionalStock: number;
  batchDiscountTiers: { maxRemainingPct: number; discountPct: number }[];
  loyaltyPointRateVnd: number;
}

export interface Db {
  categories: DbCategory[]; products: DbProduct[]; warehouses: DbWarehouse[]; areas: DbArea[]; groups: DbSalesGroup[];
  salesStaff: string[]; retailers: DbRetailer[]; registrations: DbRegistration[]; retailerMlor: Record<string, Record<string, number>>;
  retailerDist: Record<string, Record<string, number>>; whPairs: [string, string, number][];
  batches: DbBatch[]; receipts: DbReceipt[]; disposals: DbDisposal[]; transfers: DbTransfer[];
  velocity: Record<string, Record<string, [number, number, string][]>>;
  vehicles: DbVehicle[]; drivers: DbDriver[]; transit: { validFrom: Iso; bands: TransitBand[] }; transitTables: DbTransitTable[]; settings: DbSettings;
  orders: DbOrder[]; pickStatus: Record<string, 'NotPicked' | 'Picking' | 'Shipped'>;
  promotions: DbPromotion[]; batchDiscounts: DbBatchDiscount[];
  loyaltyProgram: DbLoyaltyProgram; loyalty: DbLoyaltyAccount[]; gifts: DbGift[]; redemptions: DbRedemption[];
  rotationStatus: Record<string, { status: 'Approved' | 'Skipped'; transferCode: string | null }>; rotationQty: Record<string, number>;
  complaints: DbComplaint[]; users: DbUser[]; kpi: DbKpiRow[]; topProducts: [string, number, number][]; notifications: DbNotification[];
}
