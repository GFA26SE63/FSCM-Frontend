export type WarehouseType = 'Central' | 'Regional';
export type WarehouseStatus = 'Active' | 'Paused';
export type SortOrder = 'desc' | 'asc';

export interface WarehouseRegion {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  warehouseCount?: number;
}

export interface CreateRegionInput {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateRegionInput {
  name: string;
  description?: string;
}

export interface Warehouse {
  id?: string;
  code: string;
  name: string;
  regionId?: string;
  regionName?: string;
  address: string;
  lat: number;
  lng: number;
  type?: WarehouseType;
  keeperId?: string | null;
  keeperName: string | null;
  capacityPallets: number;
  minStock: number;
  isActive?: boolean;
  status: WarehouseStatus;
  batchCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RetailerDistance {
  retailerId?: string;
  retailerCode: string;
  retailerName: string;
  lat?: number;
  lng?: number;
  km: number;
  transitDays: number | null;
  estimatedCost: number | null;
  withinRange: boolean;
}

export interface WarehouseInventoryItem {
  id?: string;
  code: string;
  sku: string;
  productName: string;
  expiry: string;
  onHand: number;
  held: number;
  available: number;
  remainingDays?: number;
  expiryStatus?: 'Normal' | 'NearExpiry' | 'Expired' | 'Disposed';
}

export interface WarehouseDetail extends Warehouse {
  retailerDistances: RetailerDistance[];
  inventory: WarehouseInventoryItem[];
  transitTableVersion?: number;
  dmaxRetailerKm?: number;
}

export interface WarehouseInput {
  code: string;
  name: string;
  regionId: string;
  address: string;
  lat: number;
  lng: number;
  type?: WarehouseType;
  keeperId?: string | null;
  keeperName: string | null;
  capacityPallets: number;
  minStock: number;
  status: WarehouseStatus;
}

export interface WarehouseKeeperOption {
  id: string;
  name: string;
  loginName?: string;
  scope?: string;
}

export interface MapPoint {
  lat: number;
  lng: number;
  kind: 'wh' | 'central' | 'ret';
  label: string;
  sub?: string;
  regionId?: string;
  regionName?: string;
}
