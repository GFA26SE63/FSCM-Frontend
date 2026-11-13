import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { userApi } from '@/features/users/api';
import { receiptApi } from './api';

export const UNKNOWN_USER = 'Không xác định';
export const NOT_APPROVED = 'Chưa duyệt';
const LOADING = '…';

interface Known {
  fullName?: string;
  email?: string;
}

/** Họ tên → tên tài khoản (email) → "Không xác định". Không bao giờ trả về mã người dùng. */
function display(entry: Known | undefined): string {
  const name = entry?.fullName?.trim();
  if (name) return name;
  const account = entry?.email?.trim();
  return account || UNKNOWN_USER;
}

const norm = (id: string) => id.trim().toLowerCase();

/**
 * Tên hiển thị cho người tạo / người duyệt phiếu nhập.
 *
 * Phiếu nhập (GoodsReceiptResult) chỉ có createdByUserId / approvedByUserId. Tên được lấy từ
 * các nguồn người dùng hiện tại được phép xem, theo thứ tự:
 *   1. tài khoản đang đăng nhập (/auth/me),
 *   2. thủ kho của các kho (/warehouses → keepers, dùng chung cache với form nhập kho),
 *   3. Admin: GET /users/{id} cho từng mã còn lại (mỗi mã một lần, dùng chung cache với
 *      màn hình Người dùng). Vai trò khác không gọi API này (không có quyền).
 */
export function useReceiptUserNames(ids: (string | null | undefined)[]) {
  const { user } = useAuth();
  const canReadUsers = can(user, 'users.manage');

  const warehouses = useQuery({
    queryKey: ['receipts', 'warehouses', user?.id],
    queryFn: receiptApi.warehouses,
    enabled: Boolean(user),
    gcTime: 0,
  });

  // Khóa ổn định: danh sách mã duy nhất (đã chuẩn hóa) → không tạo lại truy vấn khi trang render lại.
  const idsKey = [...new Set(ids.filter((id): id is string => !!id && !!id.trim()).map(norm))].sort().join('|');
  const distinct = useMemo(() => (idsKey ? idsKey.split('|') : []), [idsKey]);

  const local = useMemo(() => {
    const map = new Map<string, Known>();
    for (const w of warehouses.data ?? []) {
      for (const k of w.keepers ?? []) {
        if (k.userId) map.set(norm(k.userId), { fullName: k.fullName, email: k.email });
      }
    }
    if (user?.id) map.set(norm(user.id), { fullName: user.name, email: user.email });
    return map;
  }, [warehouses.data, user]);

  // Chỉ hỏi /users cho mã chưa có tên từ nguồn tại chỗ (sau khi danh sách kho đã tải xong).
  const toFetch = canReadUsers && !warehouses.isPending
    ? distinct.filter((id) => !local.get(id)?.fullName)
    : [];
  const remote = useQueries({
    queries: toFetch.map((id) => ({
      queryKey: ['users', 'detail', id],
      queryFn: () => userApi.get(id),
      retry: false,
      staleTime: 5 * 60_000,
    })),
  });

  const remoteById = new Map(toFetch.map((id, i) => [id, remote[i]]));

  const nameOf = (id: string | null | undefined): string => {
    if (!id || !id.trim()) return UNKNOWN_USER;
    const key = norm(id);
    const own = local.get(key);
    if (own?.fullName?.trim()) return own.fullName.trim();
    if (warehouses.isPending) return LOADING;
    const fetched = remoteById.get(key);
    if (fetched?.isPending) return LOADING;
    if (fetched?.data) return display({ fullName: fetched.data.fullName, email: fetched.data.email || own?.email });
    return display(own);
  };

  /** Người duyệt: chưa duyệt → "Chưa duyệt"; đã duyệt nhưng không xác định được người → "Không xác định". */
  const approverOf = (receipt: { approvedByUserId: string | null; approvedAt: string | null; status: string }): string => {
    if (receipt.approvedByUserId) return nameOf(receipt.approvedByUserId);
    return receipt.approvedAt || receipt.status === 'Received' ? UNKNOWN_USER : NOT_APPROVED;
  };

  return { nameOf, approverOf };
}
