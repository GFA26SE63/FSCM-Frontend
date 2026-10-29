export interface Area {
  id?: string;
  code: string;
  name: string;
  region: string;
  managerName: string;
  wards: string[];
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
  managerName: string;
  members: string[];
  retailerCount: number;
  memberRows: GroupMember[];
  isActive?: boolean;
}

export interface SalesStaff {
  userId?: string;
  name: string;
  groupCode: string | null;
  groupId?: string | null;
  email?: string;
  phone?: string;
}

export interface AreaInput {
  code: string;
  name: string;
  region: string;
  managerName: string;
  wards?: string[];
}

export interface GroupInput {
  code: string;
  areaCode: string;
  managerName: string;
  members: string[];
}

export interface TransferInput {
  name: string;
  toGroup: string;
  effectiveDate?: string;
}

export interface GroupRetailerItem {
  code: string;
  name: string;
  address: string;
  contact: string;
  phone: string;
  kind: string;
  size: 'S' | 'M' | 'L';
  potentialClass: 'A' | 'B' | 'C';
  status: 'Active' | 'Locked';
}
