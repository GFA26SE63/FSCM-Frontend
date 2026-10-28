import { useState } from 'react';
import { Navigate, useNavigate } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { externalAuthConfig } from '@/shared/auth/externalAuth';
import { GoogleSignInButton } from '@/shared/auth/GoogleSignInButton';
import { DEMO_ACCOUNTS, PORTAL_ROLES, roleLabel, type PortalRole } from '@/shared/auth/roles';
import { env } from '@/shared/lib/env';
import { Button, useToast } from '@/shared/ui';
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
  const [forgotStep, setForgotStep] = useState<'none' | 'form' | 'sent'>('none');
  const [forgotEmail, setForgotEmail] = useState('');

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
      <div className="card login-card" style={{ width: 440, padding: 36, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#14655B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
              <path d="M3 8l9 5 9-5" />
              <path d="M12 13v8" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>FSCM Portal</div>
            <div className="muted" style={{ fontSize: 13 }}>Nhà phân phối · Web nội bộ</div>
          </div>
        </div>

        {forgotStep === 'none' && (
          <form
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              void submit(() => (env.useMock ? login(email, password, role) : loginWithMicrosoft()));
            }}
          >
            {env.useMock && (
              <>
                <div className="callout callout-info" style={{ fontSize: 12.5, padding: '10px 12px' }}>
                  Chế độ demo: chọn vai trò để đăng nhập với dữ liệu mẫu của prototype.
                </div>
                <div className="role-cards" role="radiogroup" aria-label="Vai trò demo">
                  {PORTAL_ROLES.map((r) => (
                    <button
                      type="button"
                      key={r}
                      role="radio"
                      aria-checked={r === role}
                      className={`role-card${r === role ? ' active' : ''}`}
                      onClick={() => pick(r)}
                    >
                      <span className="bold">{roleLabel[r]}</span>
                      <span className="muted small">{ROLE_HINT[r]}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <label className="lbl">
              Email / Tên đăng nhập
              <input
                className="inp"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>

            <label className="lbl">
              Mật khẩu
              <input
                className="inp"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <Button variant="primary" type="submit" loading={busy} style={{ height: 42, fontSize: 14 }}>
              Đăng nhập
            </Button>

            <button
              type="button"
              className="btn"
              style={{ height: 34, border: 'none', color: '#14655B', background: 'transparent', cursor: 'pointer', fontSize: 13 }}
              onClick={() => {
                setForgotEmail(email);
                setForgotStep('form');
              }}
            >
              Quên mật khẩu?
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
              <span style={{ flex: 1, height: 1, background: '#D3D8D2' }} />
              <span className="muted" style={{ fontSize: 12.5 }}>hoặc</span>
              <span style={{ flex: 1, height: 1, background: '#D3D8D2' }} />
            </div>

            <button
              type="button"
              className="btn"
              style={{
                height: 42,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontSize: 13.5,
              }}
              disabled={busy || (!env.useMock && !externalAuthConfig.microsoftConfigured)}
              onClick={() => void submit(() => (env.useMock ? login(email, password, role) : loginWithMicrosoft()))}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="0" y="0" width="7.2" height="7.2" fill="#F25022" />
                <rect x="8.8" y="0" width="7.2" height="7.2" fill="#7FBA00" />
                <rect x="0" y="8.8" width="7.2" height="7.2" fill="#00A4EF" />
                <rect x="8.8" y="8.8" width="7.2" height="7.2" fill="#FFB900" />
              </svg>
              Đăng nhập với Microsoft Entra ID
            </button>

            {externalAuthConfig.googleConfigured && (
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center' }}>
                <GoogleSignInButton
                  clientId={env.google.clientId}
                  disabled={busy}
                  onCredential={(credential) => void submit(() => loginWithGoogle(credential))}
                  onError={toast.error}
                />
              </div>
            )}
          </form>
        )}

        {forgotStep === 'form' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Quên mật khẩu</div>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5 }}>
                Nhập email đăng nhập Portal. Hệ thống gửi link đặt lại mật khẩu (hiệu lực 15 phút, dùng 1 lần).
              </p>
            </div>
            <label className="lbl">
              Email đăng nhập *
              <input
                className="inp"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="ten@fscm.local"
                required
              />
            </label>
            <Button
              variant="primary"
              style={{ height: 42 }}
              disabled={!forgotEmail.includes('@')}
              onClick={() => setForgotStep('sent')}
            >
              Gửi link đặt lại mật khẩu
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
