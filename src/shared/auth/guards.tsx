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

  const screenKey = ({ inventory: 'batches', 'factory-traceability': 'warehouse-trace',
    'warehouse-receipts': 'warehouse-inbound', 'warehouse-issues': 'warehouse-outbound',
    'warehouse-work': 'warehouse-inbound', receipts: 'warehouse-inbound',
    runpicking: 'warehouse-outbound', shipments: 'readiness', whtransfer: 'warehouse-transfers',
  } as Record<string, string>)[routeKey ?? ''] ?? routeKey;
  const isAllowed = user && (
    user.role === 'Admin' ||
    (allowAllPortalRoles && isPortalRole(user.role)) ||
    (screenKey && user.permissions?.includes(screenKey))
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
