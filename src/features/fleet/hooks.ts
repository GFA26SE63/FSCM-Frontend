import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { fleetApi } from './api';

export const useVehicles = () => useQuery({ queryKey: ['fleet', 'vehicles'], queryFn: fleetApi.vehicles });
export const useVehicle = (plate: string, enabled = true) => useQuery({ queryKey: ['fleet', 'vehicle', plate], queryFn: () => fleetApi.vehicle(plate), enabled });
export const useDrivers = () => useQuery({ queryKey: ['fleet', 'drivers'], queryFn: fleetApi.drivers });
export const useDriver = (code: string, enabled = true) => useQuery({ queryKey: ['fleet', 'driver', code], queryFn: () => fleetApi.driver(code), enabled });
export const useFleetWarehouses = () => useQuery({ queryKey: ['fleet', 'warehouses'], queryFn: fleetApi.warehouses });
export const useCreateVehicle = () => useApiMutation(fleetApi.createVehicle, { success: (v) => `Đã thêm xe ${v.plate}.` });
export const useUpdateVehicle = () => useApiMutation(fleetApi.updateVehicle, { success: (v) => `Đã cập nhật xe ${v.plate}.` });
export const useCreateDriver = () => useApiMutation(fleetApi.createDriver, { success: (d) => `Đã thêm người giao ${d.code} · ${d.name}.` });
export const useUpdateDriver = () => useApiMutation(fleetApi.updateDriver, { success: (d) => `Đã cập nhật người giao ${d.code}.` });
