import { ApiError } from '@/shared/api/errors';
import type { CreatableRole } from './types';

export const CREATABLE_ROLES = Object.freeze([
  'Operator',
  'SalesManager',
  'WarehouseKeeper',
  'Sales',
  'Retailer',
] as const satisfies readonly CreatableRole[]);

export function isCreatableRole(
  value: unknown,
): value is CreatableRole {
  return (
    typeof value === 'string' &&
    CREATABLE_ROLES.some((role) => role === value)
  );
}

export function assertCreatableRole(
  value: unknown,
): asserts value is CreatableRole {
  if (!isCreatableRole(value)) {
    throw new ApiError(
      400,
      'Vai trò không hợp lệ',
      value === 'Admin'
        ? 'Không được tạo hoặc nâng quyền thành Admin qua form Người dùng.'
        : 'Hãy chọn một vai trò được hỗ trợ.',
      'USER_ROLE_NOT_CREATABLE',
      {
        role: [
          'Chỉ được chọn Operator, Sales Manager, Warehouse Keeper, Sales hoặc Retailer.',
        ],
      },
    );
  }
}