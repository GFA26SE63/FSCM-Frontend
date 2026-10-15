import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { warehouseApi } from './api';

export const useWarehouses = () => useQuery({ queryKey: ['warehouses', 'list'], queryFn: warehouseApi.list });
export const useWarehouse = (code: string) => useQuery({ queryKey: ['warehouses', 'detail', code], queryFn: () => warehouseApi.get(code) });
export const useCreateWarehouse = () => useApiMutation(warehouseApi.create, { success: (w) => `Đã tạo kho ${w.code} · ${w.name}.` });
export const useUpdateWarehouse = () => useApiMutation(warehouseApi.update, { success: (w) => `Đã cập nhật kho ${w.code}.` });
