import { get, post } from '../api/http';
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

export const authApi = {
  me: () => get<CurrentUser>('/me'),
  /** Mock-only endpoint that stands in for the Entra token flow (see mock/handlers/identity.ts). */
  mockToken: (body: { email: string; password: string; role?: PortalRole }) => post<{ accessToken: string }>('/auth/mock-token', body),
};
