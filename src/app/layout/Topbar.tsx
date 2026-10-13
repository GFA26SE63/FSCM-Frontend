import { useLocation } from 'react-router-dom';
import { NotificationBell } from '@/features/notifications';
import { APP_ROUTES } from '../routes';

export function Topbar() {
  const { pathname } = useLocation();
  const [key, ...rest] = pathname.split('/').filter(Boolean);
  const route = APP_ROUTES.find((r) => r.key === key);
  const label = route?.label ?? 'FSCM Portal';
  const crumb = `FSCM Portal / ${label}${rest.length ? (rest[0] === 'new' ? ' / Tạo mới' : ' / Chi tiết') : ''}`;
  return (
    <header className="topbar">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <span className="muted small">{crumb}</span>
        <span className="topbar-title">{rest.length ? `${label} – ${rest[0] === 'new' ? 'tạo mới' : 'chi tiết'}` : label}</span>
      </div>
      <NotificationBell />
    </header>
  );
}
