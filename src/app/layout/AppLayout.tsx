import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Authenticated shell: sidebar (menu by role) + top bar + routed page. */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Topbar />
        <div className="page">
          {children}
        </div>
      </main>
    </div>
  );
}
