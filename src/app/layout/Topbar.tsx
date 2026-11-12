import { useLocation } from '@/shared/router/compat';
import { NotificationBell } from '@/features/notifications';
import { APP_ROUTES } from '../routes';
import { Breadcrumbs } from './Breadcrumbs';

export function Topbar() {
  const { pathname } = useLocation();
  const [key, ...rest] = pathname.split('/').filter(Boolean);
  const route = APP_ROUTES.find((r) => r.key === key);
  const label = route?.label ?? 'FSCM Portal';
  const detail = rest.length ? (rest[0] === 'new' ? 'Tạo mới' : 'Chi tiết') : null;
  return (
    <header className="topbar">
      <div style={{ flex: 1 }}><Breadcrumbs items={[{ label: 'FSCM Portal', to: '/orders' }, { label, to: `/${key}`, restoreList: true }, ...(detail ? [{ label: detail }] : [])]} /></div>
      <NotificationBell />
    </header>
  );
}
