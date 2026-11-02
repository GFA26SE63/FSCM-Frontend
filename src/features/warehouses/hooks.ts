import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { warehouseApi } from './api';
import type { CreateRegionInput, UpdateRegionInput, WarehouseInput } from './types';

export const useRegions = (includeInactive = true) =>
  useQuery({
    queryKey: ['warehouses', 'regions', includeInactive],
    queryFn: () => warehouseApi.listRegions(includeInactive),
  });

export const useRegion = (id: string) =>
  useQuery({
    queryKey: ['warehouses', 'region', id],
    queryFn: () => warehouseApi.getRegion(id),
    enabled: !!id,
  });

export function useCreateRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRegionInput) => warehouseApi.createRegion(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses', 'regions'] });
    },
  });
}

export function useUpdateRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRegionInput }) =>
      warehouseApi.updateRegion(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses', 'regions'] });
    },
  });
}

export function useUpdateRegionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      warehouseApi.updateRegionStatus(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses', 'regions'] });
    },
  });
}

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}

export function useUpdateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, body }: { code: string; body: WarehouseInput }) =>
      warehouseApi.update(code, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}

export function useUpdateWarehouseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, isActive }: { code: string; isActive: boolean }) =>
      warehouseApi.updateStatus(code, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
  });
}
