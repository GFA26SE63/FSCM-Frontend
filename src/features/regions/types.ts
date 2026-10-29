export interface Area {
  id?: string;
  code: string;
  name: string;
  description?: string;
  managerId?: string | null;
  managerName: string;
  groups: string[];
  retailerCount: number;
  isActive?: boolean;
}

export interface GroupMember {
  userId?: string;
  name: string;
  groupCode: string;
  revenueAfterPromo: number;
  revenueBeforePromo: number;
}

export interface SalesGroup {
  id?: string;
  regionId?: string;
  code: string;
  name?: string;
  areaCode: string;
  areaName: string;
  managerId?: string | null;
  managerName: string;
  members: string[];
  retailerCount: number;
  memberRows: GroupMember[];
  isActive?: boolean;
}

export interface SalesStaff {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  groupCode: string | null;
  groupId: string | null;
}

export interface AreaInput {
  code: string;
  name: string;
  description?: string;
  managerId?: string | null;
}

export interface GroupInput {
  code: string;
  name?: string;
  areaCode: string;
  managerId?: string | null;
  managerName?: string;
  members: string[];
}

export interface TransferInput {
  name: string;
  userId?: string;
  toGroup: string;
  destinationSalesGroupId?: string;
  effectiveDate?: string;
}

export interface GroupRetailerItem {
  id?: string;
  code: string;
  name: string;
  address: string;
  contact: string;
  phone: string;
  kind?: string;
  size?: 'S' | 'M' | 'L';
  potentialClass?: 'A' | 'B' | 'C';
  status: 'Active' | 'Locked';
}
