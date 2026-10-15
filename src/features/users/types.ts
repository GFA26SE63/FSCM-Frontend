export type UserRole = 'Admin' | 'Operator' | 'SalesManager' | 'WarehouseKeeper' | 'Sales' | 'Retailer';
/** Roles the Portal may create – Admin is provisioned at installation and cannot be created here. */
export type CreatableRole = Exclude<UserRole, 'Admin'>;
export interface User { id: string; name: string; loginName: string; role: UserRole; scope: string; status: 'Active' | 'Locked'; lastLoginAt: string | null }
export interface UserInput { role: CreatableRole; name: string; email?: string; phone?: string; warehouseCode?: string; groupCode?: string; retailerCode?: string }
export interface Option { code: string; name: string }
