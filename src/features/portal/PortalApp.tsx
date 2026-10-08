import { lazy, Suspense } from 'react'
import { Toaster } from 'sonner'
import { LoginScreen } from './components/LoginScreen'
import { PortalShell } from './components/PortalShell'
import { OrdersScreen } from './screens/OrdersScreen'
import { PickingScreen } from './screens/PickingScreen'
import { ResourceScreen } from './screens/ResourceScreen'
import { usePortalStore } from './state/portalStore'

const DashboardScreen = lazy(() =>
  import('./screens/DashboardScreen').then((module) => ({
    default: module.DashboardScreen,
  })),
)

export function PortalApp() {
  const authenticated = usePortalStore((state) => state.authenticated)
  const activePage = usePortalStore((state) => state.activePage)

  if (!authenticated) return <LoginScreen />

  const content = (() => {
    if (activePage === 'dashboard') return <DashboardScreen />
    if (activePage === 'orders') return <OrdersScreen />
    if (activePage === 'picking') return <PickingScreen />
    return <ResourceScreen page={activePage} />
  })()

  return (
    <>
      <PortalShell>
        <Suspense fallback={<div className="page-loading">Đang tải dữ liệu…</div>}>
          {content}
        </Suspense>
      </PortalShell>
      <Toaster richColors position="top-right" />
    </>
  )
}
