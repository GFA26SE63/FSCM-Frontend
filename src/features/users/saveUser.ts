import { ApiError } from '@/shared/api/errors';
import { userApi } from './api';
import type {
  Assignments,
  CreatableRole,
  ScopeKind,
  UserDetail,
} from './types';
import { assertCreatableRole } from './userPolicy';

interface SaveInput {
  id: string;
  email: string;
  fullName: string;
  role: CreatableRole;
  assignments: Assignments;
}

function directlyManagedIds(
  user: UserDetail,
  kind: ScopeKind,
): string[] {
  switch (kind) {
    case 'warehouses':
      return user.scope.warehouseIds;
    case 'sales-groups':
      return user.scope.salesGroupIds;
    case 'retailers':
      return user.scope.retailerIds;
    case 'regions':
      return [];
  }
}

export async function finishUserSave(input: SaveInput) {
  assertCreatableRole(input.role);

  // Đọc lại khi retry vì request trước có thể đã lưu một phần.
  const current = await userApi.get(input.id);

  if (current.role === 'Admin') {
    throw new ApiError(
      403,
      'Không được chỉnh sửa tài khoản Admin.',
    );
  }

  if (current.role !== input.role) {
    throw new ApiError(
      409,
      'Vai trò đã thay đổi',
      'Đóng form và mở lại để tải thông tin mới nhất.',
    );
  }

  if (
    current.fullName !== input.fullName ||
    current.email !== input.email
  ) {
    await userApi.update({
      id: input.id,
      fullName: input.fullName,
      email: input.email,
    });
  }

  const kinds: ScopeKind[] =
    input.role === 'WarehouseKeeper'
      ? ['warehouses']
      : input.role === 'Sales'
        ? ['sales-groups']
        : input.role === 'SalesManager'
          ? ['regions', 'sales-groups']
          : input.role === 'Retailer'
            ? ['retailers']
            : [];

  for (const kind of kinds) {
    const desired = [...new Set(input.assignments[kind])];

    if (kind === 'regions') {
      // Chỉ bổ sung region.
      // Không xóa theo scope.regionIds vì có quyền kế thừa.
      for (const scopeId of desired) {
        await userApi.changeScope({
          userId: input.id,
          kind,
          scopeId,
          remove: false,
        });
      }

      continue;
    }

    const existing = directlyManagedIds(current, kind);

    const remove = (scopeId: string) =>
      userApi.changeScope({
        userId: input.id,
        kind,
        scopeId,
        remove: true,
      });

    const add = (scopeId: string) =>
      userApi.changeScope({
        userId: input.id,
        kind,
        scopeId,
        remove: false,
      });

    if (kind === 'sales-groups' && desired.length > 0) {
      // Backend tự kết thúc membership cũ khi gán nhóm mới.
      if (!existing.includes(desired[0])) {
        await add(desired[0]);
      }

      continue;
    }

    if (kind === 'retailers') {
      // Một tài khoản không liên kết hai retailer cùng lúc.
      for (const id of existing) {
        if (!desired.includes(id)) await remove(id);
      }

      for (const id of desired) {
        if (!existing.includes(id)) await add(id);
      }

      continue;
    }

    // Kho: thêm mới trước rồi bỏ các kho không còn chọn.
    for (const id of desired) {
      if (!existing.includes(id)) await add(id);
    }

    for (const id of existing) {
      if (!desired.includes(id)) await remove(id);
    }
  }
}