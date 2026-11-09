import { getAll, http, post, put } from '@/shared/api/http';
import type { Warehouse, WarehouseDetail, WarehouseInput } from './types';

interface ApiWarehouse {
  id: string; code: string; name: string; type: 'Central' | 'Regional'; address?: string;
  latitude: number; longitude: number; minimumStockThresholdCartons: number;
  keepers: { fullName: string }[]; isActive: boolean;
}
const rows = () => getAll<ApiWarehouse>('/warehouses', { includeInactive: true });
const map = (w: ApiWarehouse): Warehouse => ({
  id: w.id,
  code: w.code,
  name: w.name,
  address: w.address ?? '',
  lat: w.latitude,
  lng: w.longitude,
  type: w.type,
  keeperName: w.keepers[0]?.fullName ?? null,
  capacityPallets: w.minimumStockThresholdCartons,
  status: w.isActive ? 'Active' : 'Paused',
  batchCount: 0,
});

export const warehouseApi = {
  list: async () => (await rows()).map(map),
  get: async (code: string): Promise<WarehouseDetail> => {
    const row = (await rows()).find((w) => w.code === code);
    if (!row) throw new Error(`Không tìm thấy kho ${code}.`);
    return { ...map(row), retailerDistances: [] };
  },
  create: async (v: WarehouseInput) => map(await post<ApiWarehouse>('/warehouses', { code: v.code, name: v.name, type: v.type, address: v.address, latitude: v.lat, longitude: v.lng, minimumStockThresholdCartons: v.capacityPallets })),
  update: async (v: WarehouseInput) => {
    const row = (await rows()).find((w) => w.code === v.code);
    if (!row) throw new Error(`Không tìm thấy kho ${v.code}.`);
    const updated = await put<ApiWarehouse>(`/warehouses/${row.id}`, { name: v.name, type: v.type, address: v.address, latitude: v.lat, longitude: v.lng, minimumStockThresholdCartons: v.capacityPallets });
    if (updated.isActive !== (v.status === 'Active')) await http.patch(`/warehouses/${row.id}/status`, { isActive: v.status === 'Active' });
    return map(updated);
  },
};
