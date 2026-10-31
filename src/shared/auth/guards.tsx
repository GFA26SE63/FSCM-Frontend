import type { ReactNode } from 'react';
import {
  Navigate,
  useLocation,
} from '@/shared/router/compat';
import { useAuth } from './AuthContext';
import type { PortalRole } from './roles';
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
  children,
}: {
  roles: readonly PortalRole[];
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

  if (!user || !roles.includes(user.role)) {
    return (
      <EmptyState
        title="403 – Không có quyền truy cập"
        description={
          'Tài khoản hiện tại không được phép mở màn hình này. Liên hệ Admin nếu cần cấp quyền.'
        }
      />
    );
  }

  return <>{children}</>;
}