import { get, getAll, post, put } from '@/shared/api/http';
import type { Driver, DriverDetail, DriverInput, Vehicle, VehicleDetail, VehicleInput, WarehouseOption } from './types';

export const fleetApi = {
  vehicles: () => getAll<Vehicle>('/vehicles'),
  vehicle: (plate: string) => get<VehicleDetail>(`/vehicles/${encodeURIComponent(plate)}`),
  createVehicle: (v: VehicleInput) => post<Vehicle>('/vehicles', v),
  updateVehicle: (v: VehicleInput) => put<Vehicle>(`/vehicles/${encodeURIComponent(v.plate)}`, v),
  drivers: () => getAll<Driver>('/drivers'),
  driver: (code: string) => get<DriverDetail>(`/drivers/${code}`),
  createDriver: (v: DriverInput) => post<Driver>('/drivers', v),
  updateDriver: (v: DriverInput & { code: string }) => put<Driver>(`/drivers/${v.code}`, v),
  warehouses: () => getAll<WarehouseOption>('/warehouses'),
};
