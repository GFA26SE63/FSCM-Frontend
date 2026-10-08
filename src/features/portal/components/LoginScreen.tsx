import { useState } from 'react'
import { Eye, EyeOff, PackageOpen, ShieldCheck } from 'lucide-react'
import type { PortalRole } from '../../../shared/domain/portal'
import { Button } from '../../../shared/ui'
import { usePortalStore } from '../state/portalStore'

const roles: PortalRole[] = [
  'Admin',
  'Operator',
  'Warehouse Keeper',
  'Sales Manager',
]

export function LoginScreen() {
  const login = usePortalStore((state) => state.login)
  const role = usePortalStore((state) => state.role)
  const setRole = usePortalStore((state) => state.setRole)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-story__brand">
          <PackageOpen size={25} />
          <span>FSCM</span>
        </div>
        <div className="login-story__copy">
          <span className="login-story__eyebrow">Short shelf-life operations</span>
          <h1>Control every batch from receipt to retailer.</h1>
          <p>
            One operational view for FEFO allocation, warehouse execution,
            approvals, receivables, and traceability.
          </p>
        </div>
        <div className="login-story__signal">
          <div>
            <strong>99.2%</strong>
            <span>Batch traceability</span>
          </div>
          <div>
            <strong>−18%</strong>
            <span>Expiry write-off</span>
          </div>
          <div>
            <strong>5 kho</strong>
            <span>Live network</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault()
            login()
          }}
        >
          <div className="login-form__icon">
            <ShieldCheck size={25} />
          </div>
          <div>
            <span className="login-form__eyebrow">Cổng quản trị</span>
            <h2>Đăng nhập FSCM Portal</h2>
            <p>Sử dụng tài khoản được cấp theo vai trò vận hành.</p>
          </div>
          <label className="field">
            <span>Email hoặc username</span>
            <input defaultValue="khoa.pm@fscm.local" autoComplete="username" />
          </label>
          <label className="field">
            <span>Mật khẩu</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                defaultValue="12345678"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <label className="field">
            <span>Xem bản demo với vai trò</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as PortalRole)}
            >
              {roles.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <Button type="submit" className="login-form__submit">
            Đăng nhập
          </Button>
          <button className="login-form__forgot" type="button">
            Quên mật khẩu?
          </button>
        </form>
      </section>
    </main>
  )
}
