import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BadgePercent,
  Banknote,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  ChevronDown,
  CircleGauge,
  ClipboardList,
  FolderTree,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageOpen,
  ReceiptText,
  Settings2,
  ShieldAlert,
  ShoppingBasket,
  Store,
  Truck,
  Users,
  UsersRound,
  Warehouse,
  X,
} from 'lucide-react'
import type { PortalPage, PortalRole } from '../../../shared/domain/portal'
import { initials } from '../../../shared/lib/format'
import { navigationForRole } from '../navigation'
import { usePortalStore } from '../state/portalStore'

const pageIcons: Record<PortalPage, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ShoppingBasket,
  debts: Banknote,
  picking: ClipboardList,
  receipts: ReceiptText,
  transfers: Truck,
  batches: Boxes,
  batchPromotions: BadgePercent,
  disposals: ShieldAlert,
  promotions: Gift,
  retailers: Store,
  loyalty: CircleGauge,
  regions: UsersRound,
  categories: FolderTree,
  products: PackageOpen,
  warehouses: Warehouse,
  users: Users,
  salesKpi: BarChart3,
  complaints: ShieldAlert,
  configuration: Settings2,
}

const roleProfiles: Record<PortalRole, { name: string; scope: string }> = {
  Admin: { name: 'Phạm Minh Khoa', scope: 'Toàn hệ thống' },
  Operator: { name: 'Lý Thu Trang', scope: 'Trung tâm vận hành' },
  'Warehouse Keeper': { name: 'Đỗ Văn Tâm', scope: 'Kho Thới An' },
  'Sales Manager': { name: 'Hồ Gia Bảo', scope: 'Khu vực Quận 12' },
}

const badgeByPage: Partial<Record<PortalPage, number>> = {
  orders: 3,
  debts: 1,
  transfers: 1,
  disposals: 2,
  retailers: 1,
  complaints: 1,
}

export function PortalShell({ children }: { children: ReactNode }) {
  const role = usePortalStore((state) => state.role)
  const activePage = usePortalStore((state) => state.activePage)
  const sidebarOpen = usePortalStore((state) => state.sidebarOpen)
  const setRole = usePortalStore((state) => state.setRole)
  const setActivePage = usePortalStore((state) => state.setActivePage)
  const setSidebarOpen = usePortalStore((state) => state.setSidebarOpen)
  const logout = usePortalStore((state) => state.logout)
  const navigation = navigationForRole(role)
  const profile = roleProfiles[role]
  const groups = [...new Set(navigation.map((item) => item.group))]

  return (
    <div className="portal-shell">
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Đóng menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <div className="brand-mark">
            <PackageOpen size={22} />
          </div>
          <div>
            <strong>FSCM</strong>
            <span>Operations Portal</span>
          </div>
          <button
            type="button"
            className="sidebar__close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Đóng menu"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Điều hướng portal">
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <span className="nav-group__label">{group}</span>
              {navigation
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = pageIcons[item.page]
                  const badge = badgeByPage[item.page]
                  return (
                    <button
                      key={item.page}
                      className={`nav-item ${activePage === item.page ? 'nav-item--active' : ''}`}
                      type="button"
                      onClick={() => setActivePage(item.page)}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                      {badge ? <em>{badge}</em> : null}
                    </button>
                  )
                })}
            </div>
          ))}
        </nav>

        <div className="sidebar__profile">
          <div className="avatar">{initials(profile.name)}</div>
          <div>
            <strong>{profile.name}</strong>
            <span>{profile.scope}</span>
          </div>
        </div>
      </aside>

      <div className="portal-main">
        <header className="topbar">
          <button
            className="topbar__menu"
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu"
          >
            <Menu size={21} />
          </button>
          <div className="topbar__context">
            <span>Không gian làm việc</span>
            <strong>{profile.scope}</strong>
          </div>
          <div className="topbar__actions">
            <label className="role-switcher">
              <Building2 size={16} />
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as PortalRole)}
                aria-label="Xem với vai trò"
              >
                <option>Admin</option>
                <option>Operator</option>
                <option>Warehouse Keeper</option>
                <option>Sales Manager</option>
              </select>
              <ChevronDown size={15} />
            </label>
            <button className="notification-button" type="button" aria-label="Thông báo">
              <Bell size={19} />
              <span>4</span>
            </button>
            <button className="logout-button" type="button" aria-label="Đăng xuất" onClick={logout}>
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="portal-content">{children}</main>
      </div>
    </div>
  )
}
