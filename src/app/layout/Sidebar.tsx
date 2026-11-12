import { useState } from 'react';
import { NavLink, useLocation } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { roleLabel } from '@/shared/auth/roles';
import { APP_ROUTES, type AppRoute } from '../routes';

const initials = (name: string) => name.split(' ').slice(-2).map((s) => s[0]).join('');

/** Sidebar topics (feature groups). Routes not listed fall into "Khác". */
const MENU_GROUPS: { key: string; label: string; keys: string[] }[] = [
  { key: 'overview', label: 'Tổng quan', keys: ['dashboard', 'kpi'] },
  { key: 'sales', label: 'Bán hàng & Tài chính', keys: ['orders', 'allocation', 'debts', 'refunds', 'complaints'] },
  { key: 'warehouse', label: 'Kho vận', keys: ['runpicking', 'readiness', 'receipts', 'batches', 'batchpromo', 'disposal', 'whtransfer', 'rotation', 'fleet'] },
  { key: 'customer', label: 'Khách hàng & Khuyến mãi', keys: ['retailers', 'promos', 'loyalty', 'redeem', 'gifts'] },
  { key: 'catalog', label: 'Danh mục', keys: ['regions', 'cats', 'skus', 'whs'] },
  { key: 'system', label: 'Hệ thống', keys: ['users', 'config'] },
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
  const items = user ? APP_ROUTES.filter((r) => !r.hidden && r.roles.includes(user.role)) : [];
  const groups = buildGroups(items);
  const activeGroup = groups.find((g) => g.items.some((r) => isActivePath(pathname, r.key)))?.key ?? null;
  // Accordion: only one topic is open at a time; starts with the topic of the current page.
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);
  if (!user) return null;

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
                  {g.items.map((r) => (
                    <NavLink key={r.key} to={`/${r.key}`} className={({ isActive }) => `menu menu-sub${isActive ? ' active' : ''}`}>
                      <span className="menu-dot" />
                      <span style={{ flex: 1 }}>{r.label}</span>
                    </NavLink>
                  ))}
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
