import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useApiMutation } from '@/shared/hooks';

import { fleetApi } from './api';

function useFleetAccess() {
  const { user } = useAuth();

  return {
    ownerId: user?.id,
    allowed: can(user, 'fleet.manage'),
  };
}

export function useVehicles() {
  const { ownerId, allowed } = useFleetAccess();

  return useQuery({
    queryKey: ['fleet', ownerId, 'vehicles'],
    queryFn: fleetApi.vehicles,
    enabled: allowed,
    retry: false,
    gcTime: 0,
  });
}

export function useDrivers() {
  const { ownerId, allowed } = useFleetAccess();

  return useQuery({
    queryKey: ['fleet', ownerId, 'drivers'],
    queryFn: fleetApi.drivers,
    enabled: allowed,
    retry: false,
    gcTime: 0,
  });
}

export function useVehicle(id: string, enabled = true) {
  const { ownerId, allowed } = useFleetAccess();

  return useQuery({
    queryKey: ['fleet', ownerId, 'vehicle', id],
    queryFn: () => fleetApi.vehicle(id),
    enabled: allowed && enabled && Boolean(id),
    retry: false,
    gcTime: 0,
  });
}

export function useDriver(id: string, enabled = true) {
  const { ownerId, allowed } = useFleetAccess();

  return useQuery({
    queryKey: ['fleet', ownerId, 'driver', id],
    queryFn: () => fleetApi.driver(id),
    enabled: allowed && enabled && Boolean(id),
    retry: false,
    gcTime: 0,
  });
}

export function useFleetWarehouses(enabled = true) {
  const { ownerId, allowed } = useFleetAccess();

  return useQuery({
    queryKey: ['fleet', ownerId, 'warehouses'],
    queryFn: fleetApi.warehouses,
    enabled: allowed && enabled,
    retry: false,
    gcTime: 0,
  });
}

export const useCreateVehicle = () =>
  useApiMutation(fleetApi.createVehicle, {
    permission: 'fleet.manage',
    success: (item) => `Đã thêm xe ${item.plateNumber}.`,
  });

export const useUpdateVehicle = () =>
  useApiMutation(fleetApi.updateVehicle, {
    permission: 'fleet.manage',
    success: (item) => `Đã cập nhật xe ${item.plateNumber}.`,
  });

export const useSetVehicleActive = () =>
  useApiMutation(fleetApi.setVehicleActive, {
    permission: 'fleet.manage',
    success: (item) =>
      `Đã ${item.isActive ? 'kích hoạt' : 'ngừng hoạt động'} xe ${item.plateNumber}.`,
  });

export const useCreateDriver = () =>
  useApiMutation(fleetApi.createDriver, {
    permission: 'fleet.manage',
    success: (item) => `Đã thêm tài xế ${item.fullName}.`,
  });

export const useUpdateDriver = () =>
  useApiMutation(fleetApi.updateDriver, {
    permission: 'fleet.manage',
    success: (item) => `Đã cập nhật tài xế ${item.fullName}.`,
  });

export const useSetDriverActive = () =>
  useApiMutation(fleetApi.setDriverActive, {
    permission: 'fleet.manage',
    success: (item) =>
      `Đã ${item.isActive ? 'kích hoạt' : 'ngừng hoạt động'} tài xế ${item.fullName}.`,
  });