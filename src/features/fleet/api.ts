import { getAll, http, post, put } from '@/shared/api/http';
import type { Driver, DriverDetail, DriverInput, Vehicle, VehicleDetail, VehicleInput, WarehouseOption } from './types';

interface ApiWarehouse { id: string; code: string; name: string }
interface ApiVehicle { id: string; warehouseId: string; plateNumber: string; vehicleType: string; capacity: number; isActive: boolean }
interface ApiDriver { id: string; warehouseId: string; code: string; fullName: string; phone: string; licenseNumber: string; isActive: boolean }

const warehouses = () => getAll<ApiWarehouse>('/warehouses');
const mapVehicle = (v: ApiVehicle, ws: ApiWarehouse[]): Vehicle => {
  const warehouse = ws.find((w) => w.id === v.warehouseId);
  return { id: v.id, plate: v.plateNumber, type: v.vehicleType, capacity: v.capacity, warehouseCode: warehouse?.code ?? '—', warehouseName: warehouse?.name ?? 'Chưa xác định', status: v.isActive ? 'Active' : 'Maintenance' };
};
const mapDriver = (d: ApiDriver): Driver => ({ id: d.id, code: d.code, name: d.fullName, phone: d.phone, licenseClass: d.licenseNumber, status: d.isActive ? 'Active' : 'OnLeave' });
const vehicleRows = async () => {
  const [rows, ws] = await Promise.all([getAll<ApiVehicle>('/deliveries/vehicles', { includeInactive: true }), warehouses()]);
  return rows.map((row) => mapVehicle(row, ws));
};
const driverRows = async () => (await getAll<ApiDriver>('/deliveries/drivers', { includeInactive: true })).map(mapDriver);

export const fleetApi = {
  vehicles: vehicleRows,
  vehicle: async (plate: string): Promise<VehicleDetail> => {
    const row = (await vehicleRows()).find((v) => v.plate === plate);
    if (!row) throw new Error(`Không tìm thấy xe ${plate}.`);
    return { ...row, recentTrips: [] };
  },
  createVehicle: async (v: VehicleInput) => {
    const warehouse = (await warehouses()).find((w) => w.code === v.warehouseCode);
    if (!warehouse) throw new Error('Kho quản lý không hợp lệ.');
    return mapVehicle(await post<ApiVehicle>('/deliveries/vehicles', { warehouseId: warehouse.id, plateNumber: v.plate, vehicleType: v.type, capacity: v.capacity }), [warehouse]);
  },
  updateVehicle: async (v: VehicleInput) => {
    const current = (await getAll<ApiVehicle>('/deliveries/vehicles', { includeInactive: true })).find((x) => x.plateNumber === v.plate);
    if (!current) throw new Error(`Không tìm thấy xe ${v.plate}.`);
    const updated = await put<ApiVehicle>(`/deliveries/vehicles/${current.id}`, { vehicleType: v.type, capacity: v.capacity });
    if (updated.isActive !== (v.status === 'Active')) await http.patch(`/deliveries/vehicles/${current.id}/status`, { isActive: v.status === 'Active' });
    return mapVehicle({ ...updated, isActive: v.status === 'Active' }, await warehouses());
  },
  drivers: driverRows,
  driver: async (code: string): Promise<DriverDetail> => {
    const row = (await driverRows()).find((d) => d.code === code);
    if (!row) throw new Error(`Không tìm thấy người giao ${code}.`);
    return { ...row, recentTrips: [] };
  },
  createDriver: async (v: DriverInput) => {
    const warehouse = (await warehouses())[0];
    if (!warehouse) throw new Error('Cần khai báo ít nhất một kho trước khi thêm người giao.');
    return mapDriver(await post<ApiDriver>('/deliveries/drivers', { warehouseId: warehouse.id, fullName: v.name, phone: v.phone, licenseNumber: v.licenseClass }));
  },
  updateDriver: async (v: DriverInput & { code: string }) => {
    const current = (await getAll<ApiDriver>('/deliveries/drivers', { includeInactive: true })).find((x) => x.code === v.code);
    if (!current) throw new Error(`Không tìm thấy người giao ${v.code}.`);
    const updated = await put<ApiDriver>(`/deliveries/drivers/${current.id}`, { fullName: v.name, phone: v.phone, licenseNumber: v.licenseClass });
    if (updated.isActive !== (v.status === 'Active')) await http.patch(`/deliveries/drivers/${current.id}/status`, { isActive: v.status === 'Active' });
    return mapDriver({ ...updated, isActive: v.status === 'Active' });
  },
  warehouses: async (): Promise<WarehouseOption[]> => (await warehouses()).map((w) => ({ code: w.code, name: w.name })),
};
