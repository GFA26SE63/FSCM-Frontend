import { get, patch, post, put } from '@/shared/api/http';
import { ApiError } from '@/shared/api/errors';

import type {
  CreateDriverInput,
  CreateVehicleInput,
  Driver,
  SetActiveInput,
  UpdateDriverInput,
  UpdateRecord,
  UpdateVehicleInput,
  Vehicle,
  WarehouseOption,
} from './types';

async function vehicles(): Promise<Vehicle[]> {
  return get<Vehicle[]>('/deliveries/vehicles', {
    includeInactive: true,
  });
}

async function drivers(): Promise<Driver[]> {
  return get<Driver[]>('/deliveries/drivers', {
    includeInactive: true,
  });
}

export const fleetApi = {
  vehicles,
  drivers,

  vehicle: async (id: string): Promise<Vehicle> => {
    const items = await vehicles();
    const item = items.find((vehicle) => vehicle.id === id);

    if (!item) {
      throw new ApiError(404, 'Không tìm thấy xe');
    }

    return item;
  },

  driver: async (id: string): Promise<Driver> => {
    const items = await drivers();
    const item = items.find((driver) => driver.id === id);

    if (!item) {
      throw new ApiError(404, 'Không tìm thấy tài xế');
    }

    return item;
  },

  createVehicle: (input: CreateVehicleInput) =>
    post<Vehicle>('/deliveries/vehicles', input),

  updateVehicle: ({
    id,
    input,
  }: UpdateRecord<UpdateVehicleInput>) =>
    put<Vehicle>(
      `/deliveries/vehicles/${encodeURIComponent(id)}`,
      input,
    ),

  setVehicleActive: ({ id, isActive }: SetActiveInput) =>
    patch<Vehicle>(
      `/deliveries/vehicles/${encodeURIComponent(id)}/status`,
      { isActive },
    ),

  createDriver: (input: CreateDriverInput) =>
    post<Driver>('/deliveries/drivers', input),

  updateDriver: ({
    id,
    input,
  }: UpdateRecord<UpdateDriverInput>) =>
    put<Driver>(
      `/deliveries/drivers/${encodeURIComponent(id)}`,
      input,
    ),

  setDriverActive: ({ id, isActive }: SetActiveInput) =>
    patch<Driver>(
      `/deliveries/drivers/${encodeURIComponent(id)}/status`,
      { isActive },
    ),

  warehouses: () =>
    get<WarehouseOption[]>('/warehouses', {
      includeInactive: true,
    }),
};