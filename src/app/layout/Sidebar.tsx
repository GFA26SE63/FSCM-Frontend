import { NavLink } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { roleLabel } from '@/shared/auth/roles';
import { useMenuBadges } from '@/features/notifications';
import { APP_ROUTES } from '../routes';

const initials = (name: string) => name.split(' ').slice(-2).map((s) => s[0]).join('');

export function Sidebar() {
  const { user, logout } = useAuth();
  const { data: badges } = useMenuBadges();
  if (!user) return null;
  const items = APP_ROUTES.filter((r) => !r.hidden && r.roles.includes(user.role));

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
            <path d="M3 8l9 5 9-5" />
            <path d="M12 13v8" />
          </svg>
        </div>
        <div>
          <div className="brand-name">FSCM Portal</div>
          <div className="brand-sub">Short shelf-life FMCG</div>
        </div>
      </div>

      <nav className="menu-list" aria-label="Menu">
        {items.map((r) => {
          const n = r.badge && badges ? badges[r.badge] : 0;
          return (
            <NavLink key={r.key} to={`/${r.key}`} className={({ isActive }) => `menu${isActive ? ' active' : ''}`}>
              <span className="menu-dot" />
              <span style={{ flex: 1 }}>{r.label}</span>
              {n > 0 && <span className="menu-badge">{n}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-user">
        <div className="avatar">{initials(user.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bold" style={{ fontSize: 13 }}>{user.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--c-sidebar-sub)' }}>{roleLabel[user.role]}</div>
        </div>
        <button className="btn btn-sm btn-sidebar" onClick={logout}>Thoát</button>
      </div>
    </aside>
  );
}
