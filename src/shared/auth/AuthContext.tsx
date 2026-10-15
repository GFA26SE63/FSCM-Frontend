import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { env } from '../lib/env';
import { tokenStore } from './tokenStore';
import { authApi, type CurrentUser, type ExternalIdentityProvider } from './authApi';
import { acquireMicrosoftIdToken } from './externalAuth';
import { DEMO_ACCOUNTS, type PortalRole } from './roles';

type Status = 'loading' | 'anonymous' | 'authenticated';

interface AuthState {
  status: Status;
  user: CurrentUser | null;
  /** Mock mode: email + password (any password ≥ 6 chars). */
  login: (email: string, password: string, role?: PortalRole) => Promise<CurrentUser>;
  loginWithMicrosoft: () => Promise<CurrentUser>;
  loginWithGoogle: (idToken: string) => Promise<CurrentUser>;
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

  const exchangeExternalIdentity = useCallback(
    async (provider: ExternalIdentityProvider, idToken: string) => {
      if (env.useMock) return signIn(DEMO_ACCOUNTS.Admin.email, `${provider}-sso`);
      const { accessToken } = await authApi.externalLogin(provider, idToken);
      tokenStore.set(accessToken);
      qc.clear();
      try {
        const currentUser = await authApi.me();
        setUser(currentUser);
        setStatus('authenticated');
        return currentUser;
      } catch (error) {
        tokenStore.clear();
        throw error;
      }
    },
    [qc, signIn],
  );

  const loginWithMicrosoft = useCallback(async () => {
    if (env.useMock) return signIn(DEMO_ACCOUNTS.Admin.email, 'microsoft-sso');
    return exchangeExternalIdentity('microsoft', await acquireMicrosoftIdToken());
  }, [exchangeExternalIdentity, signIn]);

  const loginWithGoogle = useCallback(
    (idToken: string) => exchangeExternalIdentity('google', idToken),
    [exchangeExternalIdentity],
  );

  const switchRole = useCallback((role: PortalRole) => signIn(DEMO_ACCOUNTS[role].email, 'demo-switch', role), [signIn]);

  const value = useMemo<AuthState>(
    () => ({ status, user, login: signIn, loginWithMicrosoft, loginWithGoogle, switchRole, logout }),
    [status, user, signIn, loginWithMicrosoft, loginWithGoogle, switchRole, logout],
  );
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
