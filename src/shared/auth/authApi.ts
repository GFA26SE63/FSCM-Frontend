import axios from 'axios';
import { get } from '../api/http';
import { ApiError, toApiError } from '../api/errors';
import { env } from '../lib/env';
import { isPortalRole, type PortalRole } from './roles';

export interface IdentityScope {
  warehouseIds: string[];
  regionIds: string[];
  salesGroupIds: string[];
  retailerIds: string[];
}

export interface ScopeLabel {
  id: string;
  code: string;
  name: string;
}

export interface IdentityScopeLabels {
  warehouses: ScopeLabel[];
  regions: ScopeLabel[];
  salesGroups: ScopeLabel[];
  retailers: ScopeLabel[];
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: PortalRole;
  mustChangePassword?: boolean;
  scope?: IdentityScope;
  scopeLabels?: IdentityScopeLabels;

  // Normalize the API response for the current UI.
  warehouseCode?: string | null;
  areaCodes?: string[];
}

interface BackendCurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  mustChangePassword?: boolean;
  scope?: IdentityScope;
  scopeLabels?: IdentityScopeLabels;
}

interface BackendAuthenticationResult {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: BackendCurrentUser;
}

export interface AuthenticationResult
  extends Omit<BackendAuthenticationResult, 'user'> {
  user: CurrentUser;
}

export interface PasswordResetRequestResult {
  message: string;
  resetToken?: string | null;
}

const identityHttp = axios.create({
  baseURL: `${env.apiBaseUrl}/api/v1/auth`,
  timeout: 20_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

function mapCurrentUser(user: BackendCurrentUser): CurrentUser {
  if (!user || !isPortalRole(user.role)) {
    throw new ApiError(
      403,
      'Không có quyền truy cập Portal',
      'Tài khoản này không thuộc vai trò được phép sử dụng Portal.',
    );
  }

  const warehouseCode =
    user.scopeLabels?.warehouses?.[0]?.code ?? null;
  const areaCodes =
    user.scopeLabels?.regions?.map((region) => region.code) ?? [];

  return {
    id: String(user.id),
    name: user.fullName,
    email: user.email,
    role: user.role,
    mustChangePassword: Boolean(user.mustChangePassword),
    scope: user.scope,
    scopeLabels: user.scopeLabels,
    warehouseCode,
    areaCodes,
  };
}

export const authApi = {
  async loginLocal(
    email: string,
    password: string,
  ): Promise<AuthenticationResult> {
    try {
      const response = await identityHttp.post<BackendAuthenticationResult>(
        '/login',
        {
          email: email.trim(),
          password,
        },
      );

      if (
        !response.data.accessToken ||
        !response.data.refreshToken
      ) {
        throw new ApiError(
          502,
          'Phản hồi đăng nhập không hợp lệ',
          'Backend không trả đủ thông tin phiên.',
        );
      }

      return {
        ...response.data,
        user: mapCurrentUser(response.data.user),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async me(): Promise<CurrentUser> {
    const user = await get<BackendCurrentUser>('/auth/me');
    return mapCurrentUser(user);
  },

  async exchangeGoogle(
    googleIdToken: string,
  ): Promise<AuthenticationResult> {
    try {
      const response = await identityHttp.post<BackendAuthenticationResult>(
        '/google/exchange',
        undefined,
        {
          headers: {
            Authorization: `Bearer ${googleIdToken}`,
          },
        },
      );

      if (
        !response.data.accessToken ||
        !response.data.refreshToken
      ) {
        throw new ApiError(
          502,
          'Phản hồi đăng nhập không hợp lệ',
          'Backend không trả đủ thông tin phiên.',
        );
      }

      return {
        ...response.data,
        user: mapCurrentUser(response.data.user),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async requestPasswordReset(
    email: string,
  ): Promise<PasswordResetRequestResult> {
    try {
      const response = await identityHttp.post<PasswordResetRequestResult>(
        '/password-reset/request',
        { email: email.trim() },
      );

      return response.data;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async logout(refreshToken: string): Promise<void> {
    try {
      await identityHttp.post('/logout', { refreshToken });
    } catch (error) {
      throw toApiError(error);
    }
  },
};
