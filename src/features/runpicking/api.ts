import { getAll } from '@/shared/api/http';
import type { PickingList, WarehouseOption } from './types';

export const pickingApi = {
  lists: (warehouseId?: string, status?: string) =>
    getAll<PickingList>('/picking-lists', { warehouseId: warehouseId || undefined, status: status || undefined }),
  warehouses: () => getAll<WarehouseOption>('/warehouses'),
};
