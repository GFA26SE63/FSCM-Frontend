import { get, post } from '../api/http';
import { ApiError } from '../api/errors';
import { env } from '../lib/env';
import {
  isPortalRole,
  type PortalRole,
} from './roles';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: PortalRole;
  warehouseCode?: string | null;
  areaCodes?: string[];
}

export type ExternalIdentityProvider =
  | 'microsoft'
  | 'google';

interface BackendCurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export const authApi = {
  async me(): Promise<CurrentUser> {
    if (env.useMock) {
      return get<CurrentUser>('/me');
    }

    const user =
      await get<BackendCurrentUser>('/auth/me');

    if (!isPortalRole(user.role)) {
      throw new ApiError(
        403,
        'Không có quyền truy cập Portal',
      );
    }

    return {
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: user.role,
    };
  },

  externalLogin: (
    provider: ExternalIdentityProvider,
    idToken: string,
  ) =>
    post<{
      accessToken: string;
      refreshToken?: string;
    }>('/auth/external-login', {
      provider,
      idToken,
    }),

  mockToken: (body: {
    email: string;
    password: string;
    role?: PortalRole;
  }) =>
    post<{ accessToken: string }>(
      '/auth/mock-token',
      body,
    ),
};