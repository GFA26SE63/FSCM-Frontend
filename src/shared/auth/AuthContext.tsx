import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { env } from '../lib/env';
import { ApiError } from '../api/errors';
import { tokenStore } from './tokenStore';
import { authApi, type CurrentUser } from './authApi';
import { entraConfig } from './entraConfig';
import { DEMO_ACCOUNTS, type PortalRole } from './roles';

type Status = 'loading' | 'anonymous' | 'authenticated';

interface AuthState {
  status: Status;
  user: CurrentUser | null;
  /** Mock mode: email + password (any password ≥ 6 chars). */
  login: (email: string, password: string, role?: PortalRole) => Promise<CurrentUser>;
  /** Real mode: redirect to Microsoft Entra ID (placeholder until MSAL is wired). */
  loginWithEntra: () => Promise<CurrentUser>;
  /** Demo role switcher in the sidebar – signs in as the demo account of that role. */
  switchRole: (role: PortalRole) => Promise<CurrentUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>(tokenStore.get() ? 'loading' : 'anonymous');
  const [user, setUser] = useState<CurrentUser | null>(null);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('anonymous');
    qc.clear();
  }, [qc]);

  useEffect(() => {
    tokenStore.setUnauthorizedHandler(logout);
    if (tokenStore.get()) {
      authApi
        .me()
        .then((u) => {
          setUser(u);
          setStatus('authenticated');
        })
        .catch(() => logout());
    }
    return () => tokenStore.setUnauthorizedHandler(null);
  }, [logout]);

  const signIn = useCallback(
    async (email: string, password: string, role?: PortalRole) => {
      const { accessToken } = await authApi.mockToken({ email, password, role });
      tokenStore.set(accessToken);
      qc.clear();
      const u = await authApi.me();
      setUser(u);
      setStatus('authenticated');
      return u;
    },
    [qc],
  );

  const loginWithEntra = useCallback(async () => {
    if (env.useMock) return signIn(DEMO_ACCOUNTS.Admin.email, 'entra-sso');
    if (!entraConfig.isConfigured) throw new ApiError(400, 'Chưa cấu hình Microsoft Entra ID', 'Điền VITE_ENTRA_TENANT_ID / VITE_ENTRA_CLIENT_ID trong .env rồi tích hợp @azure/msal-browser.');
    // TODO(entra): msal.loginRedirect({ scopes: entraConfig.scopes }) → acquireTokenSilent → tokenStore.set(token)
    throw new ApiError(501, 'Đăng nhập Entra ID chưa được tích hợp trong base code');
  }, [signIn]);

  const switchRole = useCallback((role: PortalRole) => signIn(DEMO_ACCOUNTS[role].email, 'demo-switch', role), [signIn]);

  const value = useMemo<AuthState>(() => ({ status, user, login: signIn, loginWithEntra, switchRole, logout }), [status, user, signIn, loginWithEntra, switchRole, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Convenience for components: current role (throws if not signed in). */
export function useRole(): PortalRole {
  const { user } = useAuth();
  if (!user) throw new Error('Not authenticated');
  return user.role;
}
