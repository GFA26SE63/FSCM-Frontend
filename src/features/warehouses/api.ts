import { get, getAll, post, put } from '@/shared/api/http';
import type { Warehouse, WarehouseDetail, WarehouseInput } from './types';

export const warehouseApi = {
  list: () => getAll<Warehouse>('/warehouses'),
  get: (code: string) => get<WarehouseDetail>(`/warehouses/${code}`),
  create: (v: WarehouseInput) => post<Warehouse>('/warehouses', v),
  update: (v: WarehouseInput) => put<Warehouse>(`/warehouses/${v.code}`, v),
};
