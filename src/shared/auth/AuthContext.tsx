import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tokenStore } from './tokenStore';
import { authApi, type CurrentUser } from './authApi';
import { acquireMicrosoftIdToken } from './externalAuth';
import type { PortalRole } from './roles';

type AuthStatus =
  | 'loading'
  | 'anonymous'
  | 'authenticated';

interface AuthState {
  status: AuthStatus;
  user: CurrentUser | null;
  login: (email: string, password: string) => Promise<CurrentUser>;
  loginWithMicrosoft: () => Promise<CurrentUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<AuthStatus>(
    tokenStore.get() ? 'loading' : 'anonymous',
  );
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [sessionMessage, setSessionMessage] =
    useState<string | null>(null);

  const version = useRef(0);
  const loginBusy = useRef(false);

  const clearSession = useCallback(
    (message: string | null = null) => {
      version.current += 1;
      tokenStore.clear();
      setUser(null);
      setStatus('anonymous');
      setSessionMessage(message);
      queryClient.clear();
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    const refreshToken = tokenStore.getRefreshToken();

    clearSession();

    if (!env.useMock && refreshToken) {
      void authApi.logout(refreshToken).catch(() => {
        // Phiên trên FE đã được xóa.
        // Chỉ hiển thị nếu chưa bắt đầu một phiên khác.
        if (!tokenStore.get()) {
          setSessionMessage(
            'Đã thoát trên trình duyệt này. Không kết nối được máy chủ để thu hồi phiên.',
          );
        }
      });
    }
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;
    const currentVersion = version.current;

    tokenStore.setUnauthorizedHandler(() => {
      clearSession(
        'Phiên đăng nhập đã hết hạn hoặc không còn hợp lệ. Hãy đăng nhập lại.',
      );
    });

    if (tokenStore.get()) {
      void authApi.me().then(
        (currentUser) => {
          if (
            cancelled ||
            version.current !== currentVersion
          ) {
            return;
          }

          setUser(currentUser);
          setStatus('authenticated');
        },
        (error: unknown) => {
          if (
            cancelled ||
            version.current !== currentVersion
          ) {
            return;
          }

          clearSession(errorMessage(error));
        },
      );
    }
    return () => tokenStore.setUnauthorizedHandler(null);
  }, [logout]);

  const acceptToken = useCallback(
    async (request: Promise<{ accessToken: string }>) => {
      const { accessToken } = await request;
      tokenStore.set(accessToken);
      qc.clear();
      try {
        const session = await acquireSession();

        if (version.current !== currentVersion) {
          throw new ApiError(
            409,
            'Yêu cầu đăng nhập không còn hiệu lực',
          );
        }

        tokenStore.set(
          session.accessToken,
          session.refreshToken,
        );

        const currentUser = await authApi.me();

        if (version.current !== currentVersion) {
          throw new ApiError(
            409,
            'Phiên đăng nhập đã thay đổi',
          );
        }

        setUser(currentUser);
        setStatus('authenticated');

        return currentUser;
      } catch (error) {
        if (version.current === currentVersion) {
          clearSession();
        }

        throw error;
      } finally {
        loginBusy.current = false;
      }
    },
    [clearSession, queryClient],
  );

  const login = useCallback(
    async (
      email: string,
      password: string,
      role?: PortalRole,
    ): Promise<CurrentUser> => {
      if (!env.useMock) {
        throw new ApiError(
          403,
          'Đăng nhập demo đã bị tắt',
        );
      }

      return authenticate(() =>
        authApi.mockToken({ email, password, role }),
      );
    },
    [authenticate],
  );

  const loginWithPassword = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<CurrentUser> => {
      if (env.useMock) {
        return login(email, password);
      }

      return authenticate(() =>
        authApi.loginLocal(email, password),
      );
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
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider',
    );
  }

  return context;
}

export function useRole(): PortalRole {
  const { user } = useAuth();

  if (!user) {
    throw new Error('Not authenticated');
  }

  return user.role;
}