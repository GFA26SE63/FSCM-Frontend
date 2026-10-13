import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Authenticated shell: sidebar (menu by role) + top bar + routed page. */
export function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Topbar />
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
