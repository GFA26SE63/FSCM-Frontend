export interface Vehicle {
  id: string;
  warehouseId: string;
  plateNumber: string;
  vehicleType: string;
  capacity: number;
  isActive: boolean;
}

export interface Driver {
  id: string;
  warehouseId: string;
  code: string;
  fullName: string;
  phone: string;
  licenseNumber: string;
  isActive: boolean;
}

export interface WarehouseOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface CreateVehicleInput {
  warehouseId: string;
  plateNumber: string;
  vehicleType: string;
  capacity: number;
}

export interface UpdateVehicleInput {
  vehicleType: string;
  capacity: number;
}

export interface CreateDriverInput {
  warehouseId: string;
  code?: string;
  fullName: string;
  phone: string;
  licenseNumber: string;
}

export interface UpdateDriverInput {
  fullName: string;
  phone: string;
  licenseNumber: string;
}

export interface UpdateRecord<T> {
  id: string;
  input: T;
}

export interface SetActiveInput {
  id: string;
  isActive: boolean;
}

export type FleetStatusTarget =
  | { kind: 'vehicle'; item: Vehicle }
  | { kind: 'driver'; item: Driver };

export function activeText(isActive: boolean): string {
  return isActive ? 'Hoạt động' : 'Ngừng hoạt động';
}

export function warehouseText(
  warehouses: WarehouseOption[] | undefined,
  id: string,
): string {
  const warehouse = warehouses?.find((item) => item.id === id);

  return warehouse
    ? `${warehouse.code} · ${warehouse.name}`
    : id;
}