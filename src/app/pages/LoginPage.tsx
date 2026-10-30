import { matchPath } from 'react-router-dom';
import { useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import {
  Navigate,
  useLocation,
} from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { type PortalRole } from '@/shared/auth/roles';
import { errorMessage } from '@/shared/api/errors';
import { env } from '@/shared/lib/env';
import {
  Button,
  FormField,
  Input,
} from '@/shared/ui';
import { APP_ROUTES, HOME_BY_ROLE } from '../routes';

type LoginMethod = 'password' | 'google';

function getReturnPath(
  state: unknown,
  role: PortalRole,
): string | null {
  if (
    typeof state !== 'object' ||
    state === null ||
    !('from' in state) ||
    typeof state.from !== 'string'
  ) {
    return null;
  }

  const path = state.from;

  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    /[?#]/.test(path)
  ) {
    return null;
  }

  // Hiện RequireAuth chỉ lưu pathname.
  // Chỉ nhận URL khớp một route thật trong ứng dụng.
  const route = APP_ROUTES.find((item) => {
    const patterns = [
      `/${item.key}`,
      ...(item.sub ?? []).map(
        (sub) => `/${item.key}/${sub.path}`,
      ),
    ];

    return patterns.some(
      (pattern) => matchPath(path, {
        path: pattern,
        exact: true,
        strict: false,
      }) !== null,
    );
  });

  if (!route || !route.roles.includes(role)) {
    return null;
  }

  return path;
}

export function LoginPage() {
  const {
    status,
    user,
    sessionMessage,
    loginWithPassword,
    loginWithGoogle,
  } = useAuth();

  const location = useLocation();
  const submitting = useRef(false);

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [busy, setBusy] =
    useState<LoginMethod | null>(null);

  const [error, setError] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <div className="boot">
        Đang khôi phục phiên đăng nhập…
      </div>
    );
  }

  if (status === 'authenticated' && user) {
    const destination =
      getReturnPath(location.state, user.role) ??
      HOME_BY_ROLE[user.role];

    return <Navigate to={destination} replace />;
  }

  const submitPassword = async () => {
    if (submitting.current) return;

    if (
      !email.trim() || !password
    ) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }

    submitting.current = true;
    setBusy('password');
    setError(null);

    try {
      await loginWithPassword(email.trim(), password);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      submitting.current = false;
      setBusy(null);
    }
  };

  const isBusy = busy !== null;

  const submitGoogle = async (googleIdToken: string) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy('google');
    setError(null);

    try {
      await loginWithGoogle(googleIdToken);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      submitting.current = false;
      setBusy(null);
    }
  };

  return (
    <div className="login-wrap">
      <form
        className="card login-card"
        aria-busy={isBusy}
        onSubmit={(event) => {
          event.preventDefault();
          void submitPassword();
        }}
      >
        <div>
          <div
            className="bold"
            style={{ fontSize: 24 }}
          >
            FSCM Portal
          </div>

          <p className="muted">
            Đăng nhập để tiếp tục.
          </p>
        </div>

        {sessionMessage && (
          <div className="callout" role="status">
            {sessionMessage}
          </div>
        )}

        {error && (
          <div className="callout" role="alert">
            {error}
          </div>
        )}

        <FormField label="Email">
          <Input
            type="email"
            name="email"
            value={email}
            required
            disabled={isBusy}
            autoComplete="username"
            placeholder="Nhập email tài khoản FSCM"
            onChange={(event) =>
              setEmail(event.target.value)
            }
          />
        </FormField>

        <FormField label="Mật khẩu">
          <Input
            type="password"
            name="password"
            value={password}
            required
            disabled={isBusy}
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            onChange={(event) =>
              setPassword(event.target.value)
            }
          />
        </FormField>

        <Button
          type="submit"
          variant="primary"
          loading={busy === 'password'}
          disabled={isBusy}
        >
          Đăng nhập
        </Button>

        <>
            <div className="oauth-divider">
              <span>hoặc</span>
            </div>

            {env.google.clientId && !isBusy && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin
                  text="signin_with"
                  onSuccess={(response) => {
                    if (response.credential) {
                      void submitGoogle(response.credential);
                    } else {
                      setError('Google không trả về ID token. Hãy thử lại.');
                    }
                  }}
                  onError={() =>
                    setError('Đăng nhập Google thất bại. Hãy thử lại.')
                  }
                />
              </div>
            )}

            {busy === 'google' && (
              <p className="muted small">Đang đăng nhập bằng Google…</p>
            )}

            {!env.google.clientId && (
              <p className="muted small">
                Đăng nhập Google chưa sẵn sàng.
                Bạn vẫn có thể dùng tài khoản FSCM.
              </p>
            )}
        </>
      </form>
    </div>
  );
}
