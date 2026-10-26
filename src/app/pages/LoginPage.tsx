import { useState } from 'react';
import { Navigate, useNavigate } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { externalAuthConfig } from '@/shared/auth/externalAuth';
import { GoogleSignInButton } from '@/shared/auth/GoogleSignInButton';
import { DEMO_ACCOUNTS, PORTAL_ROLES, roleLabel, type PortalRole } from '@/shared/auth/roles';
import { env } from '@/shared/lib/env';
import { Button, FormField, Input, useToast } from '@/shared/ui';
import { HOME_BY_ROLE } from '../routes';

const ROLE_HINT: Record<PortalRole, string> = {
  Admin: 'Toàn bộ menu',
  Operator: 'Duyệt đơn, giao hàng, công nợ',
  WarehouseKeeper: 'Picking, nhập kho, điều chuyển',
  SalesManager: 'Khu vực, nhóm Sales, KPI',
};

export function LoginPage() {
  const { status, user, login, loginWithMicrosoft, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [role, setRole] = useState<PortalRole>('Admin');
  const [email, setEmail] = useState(DEMO_ACCOUNTS.Admin.email);
  const [password, setPassword] = useState('12345678');
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated' && user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;

  const pick = (r: PortalRole) => {
    setRole(r);
    setEmail(DEMO_ACCOUNTS[r].email);
  };
  const submit = async (fn: () => Promise<{ role: PortalRole }>) => {
    setBusy(true);
    try {
      const u = await fn();
      navigate(HOME_BY_ROLE[u.role], { replace: true });
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form
        className="card login-card"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(() => (env.useMock ? login(email, password, role) : loginWithMicrosoft()));
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

        {env.useMock ? (
          <>
            <div className="callout callout-info small">Chế độ mock (VITE_USE_MOCK=true): chọn vai trò để đăng nhập với dữ liệu mẫu của prototype.</div>
            <div className="role-cards" role="radiogroup" aria-label="Vai trò demo">
              {PORTAL_ROLES.map((r) => (
                <button type="button" key={r} role="radio" aria-checked={r === role} className={`role-card${r === role ? ' active' : ''}`} onClick={() => pick(r)}>
                  <span className="bold">{roleLabel[r]}</span>
                  <span className="muted small">{ROLE_HINT[r]}</span>
                </button>
              ))}
            </div>
            <FormField label="Email / Tên đăng nhập">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </FormField>
            <FormField label="Mật khẩu" hint="Mock: nhập bất kỳ mật khẩu từ 6 ký tự.">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </FormField>
            <Button variant="primary" type="submit" loading={busy} style={{ height: 42 }}>
              Đăng nhập
            </Button>
          </>
        ) : (
          <>
            <p className="note">Microsoft hoặc Google chỉ xác thực danh tính. Sau đăng nhập, hệ thống sử dụng JWT do FSCM phát hành cho toàn bộ API nghiệp vụ.</p>
            <Button variant="primary" type="submit" loading={busy} style={{ height: 42 }} disabled={!externalAuthConfig.microsoftConfigured}>
              Đăng nhập bằng Microsoft
            </Button>
            <div className="oauth-divider"><span>hoặc</span></div>
            {externalAuthConfig.googleConfigured ? (
              <GoogleSignInButton
                clientId={env.google.clientId}
                disabled={busy}
                onCredential={(credential) => void submit(() => loginWithGoogle(credential))}
                onError={toast.error}
              />
            ) : (
              <Button type="button" disabled>Google chưa được cấu hình</Button>
            )}
            {(!externalAuthConfig.microsoftConfigured || !externalAuthConfig.googleConfigured) && (
              <p className="note">Cấu hình client ID còn thiếu trong biến môi trường triển khai.</p>
            )}
          </>
        )}
      </form>
    </div>
  );
}
