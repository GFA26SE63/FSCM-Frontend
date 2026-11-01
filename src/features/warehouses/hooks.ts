import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { warehouseApi } from './api';
import type { WarehouseInput } from './types';

export const useWarehouses = () =>
  useQuery({ queryKey: ['warehouses', 'list'], queryFn: warehouseApi.list });

export const useWarehouse = (code: string, canViewInventory = true) =>
  useQuery({
    queryKey: ['warehouses', 'detail', code, canViewInventory],
    queryFn: () => warehouseApi.get(code, canViewInventory),
    enabled: !!code,
  });

export const useWarehouseKeepers = (enabled = true) =>
  useQuery({
    queryKey: ['warehouses', 'keepers'],
    queryFn: warehouseApi.listKeepers,
    enabled,
  });

export const useRetailerMapPoints = (enabled = true) =>
  useQuery({
    queryKey: ['warehouses', 'retailer-map-points'],
    queryFn: warehouseApi.getRetailerMapPoints,
    enabled,
  });

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: WarehouseInput) => warehouseApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouses'] }),
  });
}

export function useUpdateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, body }: { code: string; body: WarehouseInput }) =>
      warehouseApi.update(code, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouses'] }),
  });
}

export function useUpdateWarehouseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, isActive }: { code: string; isActive: boolean }) =>
      warehouseApi.updateStatus(code, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouses'] }),
  });
}
