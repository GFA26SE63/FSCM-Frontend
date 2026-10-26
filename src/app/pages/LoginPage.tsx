import { useState } from 'react';
import { Navigate, useNavigate } from '@/shared/router/compat';
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

  if (status === 'authenticated' && user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;

  const submit = async (request: () => Promise<{ role: PortalRole }>) => {
    setBusy(true);
    try {
      const currentUser = await request();
      navigate(HOME_BY_ROLE[currentUser.role], { replace: true });
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };

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
      </form>
    </div>
  );
}
