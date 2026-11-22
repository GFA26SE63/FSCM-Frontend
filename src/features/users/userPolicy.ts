import { ApiError } from '@/shared/api/errors';
import type { CreatableRole } from './types';

export const CREATABLE_ROLES = Object.freeze([
  'Operator',
  'SalesManager',
  'WarehouseKeeper',
  'Sales',
  'Retailer',
] as const satisfies readonly string[]);

export function isCreatableRole(
  value: unknown,
): value is CreatableRole {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.toLowerCase() !== 'admin'
  );
}

export function assertCreatableRole(
  value: unknown,
): asserts value is CreatableRole {
  if (typeof value === 'string' && value.toLowerCase() === 'admin') {
    throw new ApiError(
      400,
      'Vai trò không hợp lệ',
      'Không được tạo hoặc nâng quyền thành Quản trị viên (Admin) qua màn hình Người dùng.',
      'USER_ROLE_NOT_CREATABLE',
      {
        role: [
          'Tài khoản Quản trị viên (Admin) chỉ được khởi tạo một lần duy nhất theo chính sách bảo mật hệ thống.',
        ],
      },
    );
  }

  if (!isCreatableRole(value)) {
    throw new ApiError(
      400,
      'Vai trò không hợp lệ',
      'Hãy chọn một vai trò được hỗ trợ trong hệ thống.',
      'USER_ROLE_NOT_CREATABLE',
    );
  }
}
