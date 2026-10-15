import type { ReactNode } from 'react';
import { Navigate, useLocation } from '@/shared/router/compat';
import { useAuth } from './AuthContext';
import type { PortalRole } from './roles';
import { EmptyState } from '../ui/EmptyState';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div className="boot">Đang tải phiên đăng nhập…</div>;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: readonly PortalRole[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <EmptyState title="403 – Không có quyền truy cập" description="Vai trò hiện tại không được phép mở màn hình này. Đổi vai trò ở thanh bên trái (demo) hoặc liên hệ Admin." />;
  }
  return <>{children}</>;
}
