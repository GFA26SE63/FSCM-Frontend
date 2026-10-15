export type Availability = 'Active' | 'Maintenance';
export interface Vehicle { plate: string; type: string; capacity: number; warehouseCode: string; warehouseName: string; status: 'Active' | 'Maintenance' }
export interface Driver { code: string; name: string; phone: string; licenseClass: string; status: 'Active' | 'OnLeave' }
export interface Trip { orderCode: string; retailerName: string; departedAt: string; plate: string; driverName: string; status: string }
export interface VehicleDetail extends Vehicle { recentTrips: Trip[] }
export interface DriverDetail extends Driver { recentTrips: Trip[] }
export interface VehicleInput { plate: string; type: string; capacity: number; warehouseCode: string; status: Vehicle['status'] }
export interface DriverInput { name: string; phone: string; licenseClass: string; status: Driver['status'] }
export interface WarehouseOption { code: string; name: string }
