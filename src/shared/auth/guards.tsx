import type { ReactNode } from 'react';
import {
  Navigate,
  useLocation,
} from '@/shared/router/compat';
import { useAuth } from './AuthContext';
import { isPortalRole, type PortalRole } from './roles';
import { EmptyState } from '../ui/EmptyState';

export function RequireAuth({
  children,
}: {
  children: ReactNode;
}) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="boot">
        Đang tải phiên đăng nhập…
      </div>
    );
  }

  if (status !== 'authenticated') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <>{children}</>;
}

export function RequireRole({
  roles,
  routeKey,
  allowAllPortalRoles = false,
  children,
}: {
  roles: readonly PortalRole[];
  routeKey?: string;
  allowAllPortalRoles?: boolean;
  children: ReactNode;
}) {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <div className="boot">
        Đang tải quyền truy cập…
      </div>
    );
  }

  const isAllowed = user && (
    user.role === 'Admin' ||
    (allowAllPortalRoles && isPortalRole(user.role)) ||
    (routeKey && user.permissions?.includes(routeKey)) ||
    (!routeKey && user.permissions && user.permissions.length > 0) ||
    roles.includes(user.role)
  );

  if (!user || !isAllowed) {
    return (
      <EmptyState
        title="403 – Không có quyền truy cập"
        description={
          'Tài khoản hiện tại không được phép mở màn hình này. Liên hệ quản trị viên nếu cần cấp quyền.'
        }
      />
    );
  }

  return <>{children}</>;
}
