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
import {
  useQueryClient,
} from '@tanstack/react-query';

import {
  ApiError,
  errorMessage,
} from '../api/errors';
import { tokenStore } from './tokenStore';
import {
  authApi,
  type AuthenticationResult,
  type CurrentUser,
} from './authApi';
import type { PortalRole } from './roles';

type AuthStatus =
  | 'loading'
  | 'anonymous'
  | 'authenticated';

interface AuthState {
  status: AuthStatus;
  user: CurrentUser | null;
  sessionMessage: string | null;

  loginWithPassword: (
    email: string,
    password: string,
    remember?: boolean,
  ) => Promise<CurrentUser>;

  loginWithGoogle: (
    googleIdToken: string,
    remember?: boolean,
  ) => Promise<CurrentUser>;

  logout: () => void;
}

const AuthContext =
  createContext<AuthState | null>(null);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const queryClient = useQueryClient();

  const [status, setStatus] =
    useState<AuthStatus>('loading');

  const [user, setUser] =
    useState<CurrentUser | null>(null);

  const [sessionMessage, setSessionMessage] =
    useState<string | null>(null);

  const version = useRef(0);
  const loginBusy = useRef(false);

  const clearSession = useCallback(
    (message: string | null = null) => {
      version.current += 1;

      tokenStore.clear();
      queryClient.clear();

      setUser(null);
      setStatus('anonymous');
      setSessionMessage(message);
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    const refreshToken =
      tokenStore.getRefreshToken();

    tokenStore.clearEverywhere();
    queryClient.clear();
    setUser(null);
    setStatus('anonymous');
    setSessionMessage(null);

    const logoutVersion = version.current;

    if (refreshToken) {
      void authApi
        .logout(refreshToken)
        .catch(() => {
          if (
            version.current ===
            logoutVersion
          ) {
            setSessionMessage(
              'Đã đăng xuất trên trình duyệt. Không thể kết nối máy chủ để thu hồi phiên.',
            );
          }
        });
    }
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;
    const currentVersion = version.current;

    tokenStore.setUnauthorizedHandler(() => {
      clearSession(
        'Phiên đăng nhập đã hết hạn hoặc không còn hợp lệ. Hãy đăng nhập lại.',
      );
    });

    const restoreSession = async () => {
      tokenStore.startCrossTabSync();

      if (!tokenStore.hasSession()) {
        // Phiên không được "ghi nhớ" vẫn phải hoạt động ở mọi tab
        // đang mở, nhưng không được ghi refresh token vào localStorage.
        await tokenStore.requestSharedSession();
      }

      if (!tokenStore.hasSession()) {
        if (!cancelled) {
          setStatus('anonymous');
        }
        return;
      }

      // Shared HTTP tự refresh trước /me nếu
      // access token đã hoặc sắp hết hạn.
      void authApi.me().then(
        (currentUser) => {
          if (
            cancelled ||
            version.current !==
              currentVersion
          ) {
            return;
          }

          setUser(currentUser);
          setStatus('authenticated');
          setSessionMessage(null);
        },

        (error: unknown) => {
          if (
            cancelled ||
            version.current !==
              currentVersion
          ) {
            return;
          }

          clearSession(errorMessage(error));
        },
      );
    };

    const handleRemoteSession = () => {
      if (!tokenStore.hasSession()) {
        clearSession();
        return;
      }

      void restoreSession();
    };

    void restoreSession();
    window.addEventListener(
      'fscm:session-updated',
      handleRemoteSession,
    );
    window.addEventListener(
      'fscm:session-cleared',
      handleRemoteSession,
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        'fscm:session-updated',
        handleRemoteSession,
      );
      window.removeEventListener(
        'fscm:session-cleared',
        handleRemoteSession,
      );
      tokenStore.setUnauthorizedHandler(null);
    };
  }, [clearSession]);

  const authenticate = useCallback(
    async (
      acquireSession:
        () => Promise<AuthenticationResult>,
      remember: boolean,
    ): Promise<CurrentUser> => {
      if (loginBusy.current) {
        throw new ApiError(
          409,
          'Đang xử lý đăng nhập',
        );
      }

      loginBusy.current = true;

      const currentVersion =
        ++version.current;

      setSessionMessage(null);
      tokenStore.clear();
      queryClient.clear();
      setUser(null);
      setStatus('anonymous');

      try {
        const session =
          await acquireSession();

        if (
          version.current !==
          currentVersion
        ) {
          void authApi
            .logout(session.refreshToken)
            .catch(() => undefined);

          throw new ApiError(
            409,
            'Yêu cầu đăng nhập không còn hiệu lực',
          );
        }

        tokenStore.set(
          {
            accessToken:
              session.accessToken,
            accessTokenExpiresAt:
              session.accessTokenExpiresAt,
            refreshToken:
              session.refreshToken,
            refreshTokenExpiresAt:
              session.refreshTokenExpiresAt,
          },
          remember,
        );

        const currentUser = session.user;

        setUser(currentUser);
        setStatus('authenticated');

        return currentUser;
      } catch (error) {
        if (
          version.current ===
          currentVersion
        ) {
          clearSession();
        }

        throw error;
      } finally {
        loginBusy.current = false;
      }
    },
    [clearSession, queryClient],
  );

  const loginWithPassword = useCallback(
    async (
      email: string,
      password: string,
      remember = false,
    ): Promise<CurrentUser> =>
      authenticate(
        () =>
          authApi.loginLocal(
            email,
            password,
          ),
        remember,
      ),
    [authenticate],
  );

  const loginWithGoogle = useCallback(
    async (
      googleIdToken: string,
      remember = false,
    ): Promise<CurrentUser> =>
      authenticate(
        () =>
          authApi.exchangeGoogle(
            googleIdToken,
          ),
        remember,
      ),
    [authenticate],
  );

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      sessionMessage,
      loginWithPassword,
      loginWithGoogle,
      logout,
    }),
    [
      status,
      user,
      sessionMessage,
      loginWithPassword,
      loginWithGoogle,
      logout,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
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
