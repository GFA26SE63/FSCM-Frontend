import { get, http, post } from '../api/http';
import type { PortalRole } from './roles';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: PortalRole;
  /** Warehouse Keeper: assigned warehouse; Sales Manager: managed areas. */
  warehouseCode?: string | null;
  areaCodes?: string[];
}

interface BackendCurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: PortalRole;
}

const mapBackendUser = (user: BackendCurrentUser): CurrentUser => ({
  id: user.id,
  email: user.email,
  name: user.fullName,
  role: user.role,
});

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
