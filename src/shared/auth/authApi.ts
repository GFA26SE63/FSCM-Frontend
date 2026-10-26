import { get, post } from '../api/http';
import { env } from '../lib/env';
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

export type ExternalIdentityProvider = 'microsoft' | 'google';

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
  me: async () => {
    if (env.useMock) return get<CurrentUser>('/me');
    return mapBackendUser(await get<BackendCurrentUser>('/auth/me'));
  },
  /** Exchanges a short-lived provider ID token for the JWT issued by FSCM. */
  externalLogin: (provider: ExternalIdentityProvider, idToken: string) =>
    post<{ accessToken: string; refreshToken?: string }>('/auth/external-login', { provider, idToken }),
  /** Mock-only endpoint that stands in for the Entra token flow (see mock/handlers/identity.ts). */
  mockToken: (body: { email: string; password: string; role?: PortalRole }) => post<{ accessToken: string }>('/auth/mock-token', body),
};
