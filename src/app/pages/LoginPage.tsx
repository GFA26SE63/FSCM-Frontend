import { matchPath } from 'react-router-dom';
import { useRef, useState } from 'react';
import {
  Navigate,
  useLocation,
} from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { externalAuthConfig } from '@/shared/auth/externalAuth';
import {
  DEMO_ACCOUNTS,
  PORTAL_ROLES,
  roleLabel,
  type PortalRole,
} from '@/shared/auth/roles';
import { errorMessage } from '@/shared/api/errors';
import { env } from '@/shared/lib/env';
import {
  Button,
  FormField,
  Input,
} from '@/shared/ui';
import { APP_ROUTES, HOME_BY_ROLE } from '../routes';

type LoginMethod = 'password' | 'microsoft';

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
    login,
    loginWithPassword,
    loginWithMicrosoft,
  } = useAuth();

  const location = useLocation();
  const submitting = useRef(false);

  const [role, setRole] = useState<PortalRole>('Admin');

  const [email, setEmail] = useState(
    env.useMock ? DEMO_ACCOUNTS.Admin.email : '',
  );

  const [password, setPassword] = useState(
    env.useMock ? '12345678' : '',
  );

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

  const pickRole = (nextRole: PortalRole) => {
    setRole(nextRole);
    setEmail(DEMO_ACCOUNTS[nextRole].email);
    setError(null);
  };

  const submit = async (method: LoginMethod) => {
    if (submitting.current) return;

    if (
      method === 'password' &&
      (!email.trim() || !password)
    ) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }

    submitting.current = true;
    setBusy(method);
    setError(null);

    try {
      if (method === 'microsoft') {
        await loginWithMicrosoft();
      } else if (env.useMock) {
        await login(email.trim(), password, role);
      } else {
        await loginWithPassword(email.trim(), password);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      submitting.current = false;
      setBusy(null);
    }
  };

  const isBusy = busy !== null;

  return (
    <div className="login-wrap">
      <form
        className="card login-card"
        aria-busy={isBusy}
        onSubmit={(event) => {
          event.preventDefault();
          void submit('password');
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

        {env.useMock && (
          <>
            <div className="callout callout-info">
              Chế độ demo: chọn vai trò để kiểm thử.
            </div>

            <div
              className="role-cards"
              role="radiogroup"
              aria-label="Vai trò demo"
            >
              {PORTAL_ROLES.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={role === item}
                  disabled={isBusy}
                  className={
                    `role-card${role === item ? ' active' : ''}`
                  }
                  onClick={() => pickRole(item)}
                >
                  {roleLabel[item]}
                </button>
              ))}
            </div>
          </>
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
          {env.useMock ? 'Đăng nhập demo' : 'Đăng nhập'}
        </Button>

        {!env.useMock && (
          <>
            <div className="oauth-divider">
              <span>hoặc</span>
            </div>

            <Button
              type="button"
              loading={busy === 'microsoft'}
              disabled={
                isBusy ||
                !externalAuthConfig.microsoftConfigured
              }
              onClick={() => void submit('microsoft')}
            >
              Đăng nhập bằng Microsoft
            </Button>

            {!externalAuthConfig.microsoftConfigured && (
              <p className="muted small">
                Đăng nhập Microsoft chưa sẵn sàng.
                Bạn vẫn có thể dùng tài khoản FSCM.
              </p>
            )}
          </>
        )}
      </form>
    </div>
  );
}