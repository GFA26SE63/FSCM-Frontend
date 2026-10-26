import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tokenStore } from './tokenStore';
import { authApi, type CurrentUser } from './authApi';
import { acquireMicrosoftIdToken } from './externalAuth';
import type { PortalRole } from './roles';

type Status = 'loading' | 'anonymous' | 'authenticated';

interface AuthState {
  status: Status;
  user: CurrentUser | null;
  login: (email: string, password: string) => Promise<CurrentUser>;
  loginWithMicrosoft: () => Promise<CurrentUser>;
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

  const acceptToken = useCallback(
    async (request: Promise<{ accessToken: string }>) => {
      const { accessToken } = await request;
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
    [qc],
  );

  const login = useCallback(
    (email: string, password: string) => acceptToken(authApi.login(email, password)),
    [acceptToken],
  );

  const loginWithMicrosoft = useCallback(async () => {
    return acceptToken(authApi.exchangeEntra(await acquireMicrosoftIdToken()));
  }, [acceptToken]);

  const value = useMemo<AuthState>(
    () => ({ status, user, login, loginWithMicrosoft, logout }),
    [status, user, login, loginWithMicrosoft, logout],
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
