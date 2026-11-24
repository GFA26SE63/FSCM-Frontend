import { useState } from 'react';
import { NavLink, useLocation } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { isPortalRole, roleLabel } from '@/shared/auth/roles';
import { APP_ROUTES, type AppRoute } from '../routes';

const FSCM_LOGO_URL = '/src/assets/branding/fscm-logo.png';

const initials = (name: string) => name.split(' ').slice(-2).map((s) => s[0]).join('');

/** Sidebar topics (feature groups). Routes not listed fall into "Khác". */
const MENU_GROUPS: { key: string; label: string; keys: string[] }[] = [
  { key: 'overview', label: 'Tổng quan', keys: ['dashboard', 'reports', 'warehouse-report', 'kpi'] },
  { key: 'sales', label: 'Bán hàng & Tài chính', keys: ['orders', 'allocation', 'debts', 'refunds', 'complaints'] },
  { key: 'warehouse', label: 'Kho vận', keys: ['warehouse-inbound', 'warehouse-factory-requests', 'warehouse-outbound', 'warehouse-transfers', 'batches', 'warehouse-trace', 'readiness', 'batchpromo', 'disposal', 'fleet'] },
  { key: 'customer', label: 'Khách hàng & Khuyến mãi', keys: ['retailers', 'promos', 'loyalty', 'redeem', 'gifts'] },
  { key: 'catalog', label: 'Danh mục', keys: ['regions', 'cats', 'catmlor', 'skus', 'whs'] },
  { key: 'system', label: 'Hệ thống', keys: ['notifications', 'users', 'roles', 'config'] },
];

function buildGroups(items: AppRoute[]) {
  const used = new Set<string>();
  const result = MENU_GROUPS.map((g) => {
    const list = g.keys.map((k) => items.find((r) => r.key === k)).filter((r): r is AppRoute => !!r);
    list.forEach((r) => used.add(r.key));
    return { key: g.key, label: g.label, items: list };
  }).filter((g) => g.items.length > 0);
  const rest = items.filter((r) => !used.has(r.key));
  if (rest.length) result.push({ key: 'other', label: 'Khác', items: rest });
  return result;
}

const isActivePath = (pathname: string, key: string) => pathname === `/${key}` || pathname.startsWith(`/${key}/`);

export function Sidebar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const items = user
    ? APP_ROUTES.filter((r) => {
        if (r.hidden) return false;
        if (r.availableToAllPortalUsers) return isPortalRole(user.role);
        if (user.role === 'Admin') return true;
        if (user.permissions && user.permissions.length > 0) {
          return user.permissions.includes(r.key);
        }
        return r.roles.includes(user.role);
      })
    : [];
  const groups = buildGroups(items);
  const activeGroup = groups.find((g) => g.items.some((r) => isActivePath(pathname, r.key)))?.key ?? null;
  // Accordion: only one topic is open at a time; starts with the topic of the current page.
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);
  if (!user) return null;

  return (
    <aside className="sidebar">
      <NavLink to="/" exact className="brand" aria-label="Về trang mặc định">
        <div className="brand-logo">
          <img
            src={FSCM_LOGO_URL}
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src !== window.location.origin + '/fscm-logo.png') {
                target.src = '/fscm-logo.png';
              }
            }}
            alt="Biểu trưng FSCM"
            className="brand-logo-img"
          />
        </div>
        <div className="brand-copy">
          <div className="brand-name">Cổng quản trị FSCM</div>
        </div>
      </NavLink>

      <nav className="menu-list" aria-label="Danh mục chức năng">
        {groups.map((g) => {
          const isOpen = openGroup === g.key;
          const hasActive = g.items.some((r) => isActivePath(pathname, r.key));
          return (
            <div key={g.key} className="menu-group">
              <button
                type="button"
                className={`menu menu-group-head${hasActive ? ' has-active' : ''}${isOpen ? ' open' : ''}`}
                aria-expanded={isOpen}
                onClick={() => setOpenGroup(isOpen ? null : g.key)}
              >
                <span style={{ flex: 1 }}>{g.label}</span>
                <span className="menu-caret" aria-hidden>▾</span>
              </button>
              {isOpen && (
                <div className="menu-group-items">
                  {g.items.flatMap((r) => (r.menuLinks ?? [{ key: r.key, label: r.label, to: `/${r.key}` }]).map(link => (
                    <NavLink key={link.key} to={link.to}
                      isActive={(match, location) => !!match && (!r.menuLinks ||
                        (new URLSearchParams(location.search).get('kind') ?? 'redemptions') === new URLSearchParams(link.to.split('?')[1]).get('kind'))}
                      className={({ isActive }) => `menu menu-sub${isActive ? ' active' : ''}`}>
                      <span className="menu-dot" />
                      <span style={{ flex: 1 }}>{link.label}</span>
                    </NavLink>
                  )))}
                </div>
              )}
            </div>
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
