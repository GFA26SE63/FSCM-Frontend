export interface Warehouse {
  code: string; name: string; address: string; lat: number; lng: number; type: 'Central' | 'Regional'; keeperName: string | null;
  capacityPallets: number; status: 'Active' | 'Paused'; batchCount: number;
}
export interface RetailerDistance { retailerCode: string; retailerName: string; km: number; transitDays: number | null; withinRange: boolean }
export interface WarehouseDetail extends Warehouse { retailerDistances: RetailerDistance[] }
export interface WarehouseInput { code: string; name: string; address: string; lat: number; lng: number; type: Warehouse['type']; keeperName: string | null; capacityPallets: number; status: Warehouse['status'] }
