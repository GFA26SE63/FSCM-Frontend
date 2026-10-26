import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  can,
  type Permission,
} from './permissions';

export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user } = useAuth();

  if (!can(user, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}