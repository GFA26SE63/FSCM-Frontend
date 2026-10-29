import axios from 'axios';
import { get, post } from '../api/http';
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

  // Giữ tương thích với mock và UI hiện có.
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

export interface AuthenticationResult {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: BackendCurrentUser;
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
      const response = await identityHttp.post<AuthenticationResult>(
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

      return response.data;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async me(): Promise<CurrentUser> {
    if (env.useMock) {
      return get<CurrentUser>('/me');
    }

    const user = await get<BackendCurrentUser>('/auth/me');
    return mapCurrentUser(user);
  },

  async exchangeEntra(
    microsoftIdToken: string,
  ): Promise<AuthenticationResult> {
    try {
      const response = await identityHttp.post<AuthenticationResult>(
        '/entra/exchange',
        undefined,
        {
          headers: {
            Authorization: `Bearer ${microsoftIdToken}`,
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

  async mockToken(body: {
    email: string;
    password: string;
    role?: PortalRole;
  }): Promise<{ accessToken: string }> {
    if (!env.useMock) {
      throw new ApiError(
        403,
        'Đăng nhập demo đã bị tắt',
      );
    }

    return post<{ accessToken: string }>(
      '/auth/mock-token',
      body,
    );
  },
};