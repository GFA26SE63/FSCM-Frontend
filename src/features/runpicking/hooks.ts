import { useQuery } from '@tanstack/react-query';
import { pickingApi } from './api';

export const usePickingLists = (warehouseId?: string, status?: string) =>
  useQuery({
    queryKey: ['picking-lists', warehouseId ?? '', status ?? ''],
    queryFn: () => pickingApi.lists(warehouseId, status),
  });

export const useWarehouseOptions = () =>
  useQuery({ queryKey: ['picking-lists', 'warehouses'], queryFn: pickingApi.warehouses });
