import { get, http, post } from '../api/http';
import type { PortalRole } from './roles';

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
  me: async () => mapBackendUser(await get<BackendCurrentUser>('/auth/me')),
  login: (email: string, password: string) =>
    post<{ accessToken: string; refreshToken: string }>('/auth/login', { email, password }),
  /** Entra bearer token is validated by the backend exchange policy; business APIs only receive the FSCM JWT. */
  exchangeEntra: (idToken: string) =>
    http.post<{ accessToken: string; refreshToken: string }>('/auth/entra/exchange', undefined, {
      headers: { Authorization: `Bearer ${idToken}` },
    }).then((response) => response.data),
};
