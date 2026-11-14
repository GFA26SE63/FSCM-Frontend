import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { userApi } from '@/features/users/api';
import type { UserRole } from '@/features/users/types';

export const UNKNOWN_USER = 'Không xác định';
export const LOADING_USER = '…';

export interface ResolvedSalesUser {
  id: string;
  fullName?: string;
  email?: string;
  role?: UserRole | string;
}

const norm = (id: string) => id.trim().toLowerCase();

/**
 * Hiển thị định danh người tạo đơn theo thứ tự ưu tiên:
 *   1. Họ tên đầy đủ (fullName)
 *   2. Tên tài khoản / email (email)
 *   3. "Không xác định"
 *
 * Nếu người tạo không phải vai trò Sales (Admin, Retailer...),
 * gắn nhãn tiền tố vai trò để không gán sai danh tính cho Sales.
 * Tuyệt đối không hiển thị raw UUID.
 */
export function formatSalesName(entry: ResolvedSalesUser | undefined): string {
  if (!entry) return UNKNOWN_USER;
  const rawName = entry.fullName?.trim();
  const rawEmail = entry.email?.trim();
  const identity = rawName || rawEmail || UNKNOWN_USER;

  if (identity === UNKNOWN_USER) return UNKNOWN_USER;

  const role = entry.role;
  if (!role || role === 'Sales') {
    return identity;
  }
  if (role === 'Retailer') {
    return `[Điểm bán] ${identity}`;
  }
  if (role === 'Admin') {
    return `[Admin] ${identity}`;
  }
  if (role === 'Operator') {
    return `[Vận hành] ${identity}`;
  }
  if (role === 'WarehouseKeeper') {
    return `[Thủ kho] ${identity}`;
  }
  return `[${role}] ${identity}`;
}

/**
 * Hook phân giải danh tính Sales / Người tạo đơn hàng từ danh sách createdByUserId.
 *
 * Thứ tự nguồn định danh:
 *   1. Tài khoản đang đăng nhập (useAuth),
 *   2. Với Admin (có quyền users.manage): GET /users/{id} qua cache TanStack Query,
 *   3. Khi không phân giải được: trả về "Không xác định", tuyệt đối không lộ UUID.
 */
export function useOrderSales(ids: (string | null | undefined)[]) {
  const { user } = useAuth();
  const canReadUsers = can(user, 'users.manage');

  const idsKey = useMemo(() => {
    return [
      ...new Set(
        ids
          .filter((id): id is string => Boolean(id && id.trim()))
          .map(norm),
      ),
    ]
      .sort()
      .join('|');
  }, [ids]);

  const distinct = useMemo(() => (idsKey ? idsKey.split('|') : []), [idsKey]);

  const local = useMemo(() => {
    const map = new Map<string, ResolvedSalesUser>();
    if (user?.id) {
      map.set(norm(user.id), {
        id: user.id,
        fullName: user.name,
        email: user.email,
        role: user.role,
      });
    }
    return map;
  }, [user]);

  const toFetch = useMemo(() => {
    return canReadUsers
      ? distinct.filter((id) => !local.get(id)?.fullName)
      : [];
  }, [canReadUsers, distinct, local]);

  const remote = useQueries({
    queries: toFetch.map((id) => ({
      queryKey: ['users', 'detail', id],
      queryFn: () => userApi.get(id),
      retry: false,
      staleTime: 5 * 60_000,
    })),
  });

  const remoteById = useMemo(() => {
    return new Map(toFetch.map((id, index) => [id, remote[index]]));
  }, [toFetch, remote]);

  const salesUserOf = (id: string | null | undefined): ResolvedSalesUser | undefined => {
    if (!id || !id.trim()) return undefined;
    const key = norm(id);
    const own = local.get(key);
    if (own?.fullName?.trim()) return own;
    const fetched = remoteById.get(key);
    if (fetched?.data) {
      return {
        id,
        fullName: fetched.data.fullName,
        email: fetched.data.email || own?.email,
        role: fetched.data.role || own?.role,
      };
    }
    return own;
  };

  const salesNameOf = (id: string | null | undefined): string => {
    if (!id || !id.trim()) return UNKNOWN_USER;
    const key = norm(id);
    const own = local.get(key);
    if (own?.fullName?.trim()) return formatSalesName(own);
    const fetched = remoteById.get(key);
    if (fetched?.isPending) return LOADING_USER;
    if (fetched?.data) {
      return formatSalesName({
        id,
        fullName: fetched.data.fullName,
        email: fetched.data.email || own?.email,
        role: fetched.data.role || own?.role,
      });
    }
    return formatSalesName(own);
  };

  const salesSearchTextOf = (id: string | null | undefined): string => {
    const resolved = salesUserOf(id);
    const name = salesNameOf(id);
    if (!resolved) return name;
    const email = resolved.email?.trim() ?? '';
    return email && email !== name ? `${name} ${email}` : name;
  };

  const creatorLabelOf = (): string => {
    return 'Người đặt đơn';
  };

  return {
    salesNameOf,
    salesUserOf,
    salesSearchTextOf,
    creatorLabelOf,
  };
}
