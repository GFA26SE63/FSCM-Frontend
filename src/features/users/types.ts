import {
  roleLabel,
  type AppRole,
} from '@/shared/auth/roles';

import { CREATABLE_ROLES } from './userPolicy';

export type UserRole = AppRole;
export type CreatableRole = Exclude<UserRole, 'Admin'>;
export type IdentityProvider = 'Local' | 'Entra';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  identityProvider: IdentityProvider;
  createdAt: string;
  updatedAt: string;
}

export interface UserScope {
  warehouseIds: string[];
  regionIds: string[];
  salesGroupIds: string[];
  retailerIds: string[];
}

/**
 * Query user(id) chưa trả trạng thái, provider hoặc ngày tạo.
 * Không dùng kiểu User thay cho response này.
 */
export interface UserDetail {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  mustChangePassword: boolean;
  scope: UserScope;
}

export interface UserPage {
  items: User[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface UserFilters {
  search: string;
  role: string;
  activity: '' | 'active' | 'inactive';
  page: number;
  pageSize: number;
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  role: CreatableRole;
  identityProvider: IdentityProvider;
}

export interface CreatedUser {
  userId: string;
  email: string;
  role: UserRole;
  identityProvider: IdentityProvider;
  activationToken: string | null;
  activationTokenExpiresAt: string | null;
}

export interface UpdateUserInput {
  id: string;
  email: string;
  fullName: string;
}

export type ScopeKind =
  | 'warehouses'
  | 'regions'
  | 'sales-groups'
  | 'retailers';

export interface ScopeOption {
  id: string;
  code: string;
  name: string;
}

export interface ScopeConnection {
  nodes: ScopeOption[];
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
}

export type Assignments = Record<ScopeKind, string[]>;

export const roleOptions: {
  value: CreatableRole;
  label: string;
}[] = CREATABLE_ROLES.map((role) => ({
  value: role,
  label: roleLabel[role],
}));

export const assignmentKinds: Record<CreatableRole, ScopeKind[]> = {
  Operator: [],
  WarehouseKeeper: ['warehouses'],
  SalesManager: ['regions', 'sales-groups'],
  Sales: ['sales-groups'],
  Retailer: ['retailers'],
};

export const assignmentLabels: Record<ScopeKind, string> = {
  warehouses: 'Kho phụ trách',
  regions: 'Khu vực phụ trách',
  'sales-groups': 'Nhóm Sales',
  retailers: 'Retailer',
};

export const emptyAssignments = (): Assignments => ({
  warehouses: [],
  regions: [],
  'sales-groups': [],
  retailers: [],
});

export function assignmentsFromUser(user: UserDetail): Assignments {
  const values = emptyAssignments();

  switch (user.role) {
    case 'WarehouseKeeper':
      values.warehouses = [...(user.scope?.warehouseIds ?? [])];
      break;

    case 'Sales':
      values['sales-groups'] = [...(user.scope?.salesGroupIds ?? [])];
      break;

    case 'SalesManager':
      values['sales-groups'] = [...(user.scope?.salesGroupIds ?? [])];

      // Khi sửa, regions chỉ chứa các region muốn bổ sung.
      // scope.regionIds còn chứa region kế thừa từ nhóm Sales.
      break;

    case 'Retailer':
      values.retailers = [...(user.scope?.retailerIds ?? [])];
      break;
  }

  return values;
}