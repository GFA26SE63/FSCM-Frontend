import { matchPath } from 'react-router-dom';
import { useRef, useState } from 'react';
import {
  Navigate,
  useLocation,
} from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { externalAuthConfig } from '@/shared/auth/externalAuth';
import type { PortalRole } from '@/shared/auth/roles';
import { Button, FormField, Input, useToast } from '@/shared/ui';
import { HOME_BY_ROLE } from '../routes';

export function LoginPage() {
  const { status, user, login, loginWithMicrosoft } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated' && user) {
    const destination =
      getReturnPath(location.state, user.role) ??
      HOME_BY_ROLE[user.role];

  const submit = async (request: () => Promise<{ role: PortalRole }>) => {
    setBusy(true);
    try {
      const currentUser = await request();
      navigate(HOME_BY_ROLE[currentUser.role], { replace: true });
    } catch (error) {
      toast.error(error);
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
        onSubmit={(event) => {
          event.preventDefault();
          void submit(() => login(email, password));
        }}
      >
        <div className="row" style={{ gap: 12 }}>
          <div className="brand-logo" style={{ width: 40, height: 40, borderRadius: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
              <path d="M3 8l9 5 9-5" />
              <path d="M12 13v8" />
            </svg>
          </div>
          <div>
            <div className="bold" style={{ fontSize: 20 }}>FSCM Portal</div>
            <div className="muted small">Quản lý phân phối hàng hạn ngắn · FEFO</div>
          </div>
        </div>

        <p className="note">Đăng nhập vào FSCM Backend để sử dụng dữ liệu thật theo vai trò và phạm vi tài nguyên.</p>
        <FormField label="Email">
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
        </FormField>
        <FormField label="Mật khẩu">
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
        </FormField>
        <Button variant="primary" type="submit" loading={busy} style={{ height: 42 }}>Đăng nhập</Button>

        {externalAuthConfig.microsoftConfigured && (
          <>
            <div className="oauth-divider"><span>hoặc</span></div>
            <Button type="button" loading={busy} onClick={() => void submit(loginWithMicrosoft)}>Đăng nhập bằng Microsoft</Button>
          </>
        )}

        {forgotStep === 'sent' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Kiểm tra email</div>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5 }}>
                Nếu <strong>{forgotEmail}</strong> có tài khoản Portal, link đặt lại mật khẩu đã được gửi tới hộp thư. Link hết hạn sau 15 phút.
              </p>
            </div>
            <Button
              variant="primary"
              style={{ height: 42 }}
              onClick={() => {
                toast.show('Đã gửi lại link đặt lại mật khẩu.');
              }}
            >
              Gửi lại link
            </Button>
            <button
              type="button"
              className="btn"
              style={{ height: 36, border: 'none', color: '#14655B', background: 'transparent', cursor: 'pointer' }}
              onClick={() => setForgotStep('none')}
            >
              ← Quay lại đăng nhập
            </button>
          </div>
        )}
      </div>
    </div>
  );
}