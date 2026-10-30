import { matchPath } from 'react-router-dom';
import { useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Eye, EyeOff } from 'lucide-react';
import {
  Navigate,
  useLocation,
} from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { authApi } from '@/shared/auth/authApi';
import { type PortalRole } from '@/shared/auth/roles';
import { errorMessage } from '@/shared/api/errors';
import { env } from '@/shared/lib/env';
import {
  Button,
  Checkbox,
  FormField,
  Input,
  Modal,
} from '@/shared/ui';
import { APP_ROUTES, HOME_BY_ROLE } from '../routes';

type LoginMethod = 'password' | 'google';

const rememberedEmailKey = 'fscm.remembered-login-email';

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

  const [email, setEmail] = useState(() =>
    window.localStorage.getItem(rememberedEmailKey) ?? '',
  );

  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [rememberLogin, setRememberLogin] = useState(() =>
    Boolean(window.localStorage.getItem(rememberedEmailKey)),
  );

  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

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
      if (rememberLogin) {
        window.localStorage.setItem(rememberedEmailKey, email.trim());
      } else {
        window.localStorage.removeItem(rememberedEmailKey);
      }
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

  const openForgotPassword = () => {
    setResetEmail(email.trim());
    setResetMessage(null);
    setResetError(null);
    setForgotOpen(true);
  };

  const requestPasswordReset = async () => {
    if (!resetEmail.trim() || resetBusy) return;

    setResetBusy(true);
    setResetMessage(null);
    setResetError(null);

    try {
      await authApi.requestPasswordReset(resetEmail);
      setResetMessage(
        'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được tạo.',
      );
    } catch (cause) {
      setResetError(errorMessage(cause));
    } finally {
      setResetBusy(false);
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
          <div className="password-input">
            <Input
              type={showPassword ? 'text' : 'password'}
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
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
              disabled={isBusy}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </FormField>

        <div className="login-options">
          <Checkbox
            label="Ghi nhớ đăng nhập"
            checked={rememberLogin}
            disabled={isBusy}
            onChange={(checked) => {
              setRememberLogin(checked);
              if (!checked) {
                window.localStorage.removeItem(rememberedEmailKey);
              }
            }}
          />
          <button
            type="button"
            className="link-btn"
            disabled={isBusy}
            onClick={openForgotPassword}
          >
            Quên mật khẩu?
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          block
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
              <div className="google-login-button">
                <GoogleLogin
                  text="signin_with"
                  width="368"
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

      <Modal
        open={forgotOpen}
        title="Quên mật khẩu"
        subtitle="Nhập email tài khoản FSCM để nhận hướng dẫn đặt lại mật khẩu."
        width={440}
        onClose={() => !resetBusy && setForgotOpen(false)}
        footer={
          <>
            <Button disabled={resetBusy} onClick={() => setForgotOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              loading={resetBusy}
              disabled={!resetEmail.trim()}
              onClick={() => void requestPasswordReset()}
            >
              Gửi yêu cầu
            </Button>
          </>
        }
      >
        {resetMessage ? (
          <div className="callout callout-ok" role="status">
            {resetMessage}
          </div>
        ) : (
          <FormField label="Email">
            <Input
              type="email"
              name="reset-email"
              value={resetEmail}
              required
              autoComplete="email"
              disabled={resetBusy}
              autoFocus
              placeholder="Nhập email tài khoản FSCM"
              onChange={(event) => setResetEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void requestPasswordReset();
                }
              }}
            />
          </FormField>
        )}
        {resetError && (
          <div className="callout callout-danger" role="alert">
            {resetError}
          </div>
        )}
      </Modal>
    </div>
  );
}
