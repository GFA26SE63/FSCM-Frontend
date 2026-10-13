export interface Weights { wE: number; wD: number; wQ: number }
export interface SystemSettings {
  allocation: Weights;
  dmaxRetailerKm: number;
  dmaxWarehouseKm: number;
  rotation: Weights & { velocityDays: number; minQty: number; roundTo: number };
  minRegionalStock: number;
  batchDiscountTiers: { maxRemainingPct: number; discountPct: number }[];
  loyaltyPointRateVnd: number;
}
export interface TransitBand { fromKm: number; toKm: number; days: number; cost: number; scope: 'RetailerAndWarehouse' | 'WarehouseOnly' }
export interface TransitTable { validFrom: string; dmaxRetailerKm: number; dmaxWarehouseKm: number; bands: TransitBand[] }
export interface ConfigDraft { settings: SystemSettings; bands: TransitBand[] }
