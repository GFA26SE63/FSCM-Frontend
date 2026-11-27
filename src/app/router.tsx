import { Suspense } from 'react';
import { Navigate, Route, Switch } from '@/shared/router/compat';
import { RequireAuth, RequireRole } from '@/shared/auth/guards';
import { useAuth } from '@/shared/auth/AuthContext';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PayOsCallbackPage } from './pages/PayOsCallbackPage';
import { APP_ROUTES } from './routes';

const Loading = () => (
  <div className="loading">
    <span className="spinner" /> Đang tải màn hình…
  </div>
);

function Home() {
  const { user } = useAuth();
  const first = user && APP_ROUTES.find(r => !r.hidden && !r.availableToAllPortalUsers &&
    (user.role === 'Admin' || user.permissions?.includes(r.key)));
  return <Navigate to={!user ? '/login' : first ? `/${first.key}` : '/notifications'} replace />;
}

/** Route table: /login + the authenticated shell; every screen is wrapped in a role guard (SPEC §10). */
export function AppRouter() {
  return (
    <Switch>
      <Route path="/login" exact><LoginPage /></Route>
      <Route path="/payments/payos/:result" exact><PayOsCallbackPage /></Route>
      <Route path="/">
        <RequireAuth>
          <AppLayout>
            <Switch>
              <Route path="/" exact><Home /></Route>
              {APP_ROUTES.flatMap((r) => {
                const guard = (El: React.ComponentType) => (
                  <RequireRole roles={r.roles} routeKey={r.key} allowAllPortalRoles={r.availableToAllPortalUsers}>
                    <Suspense fallback={<Loading />}>
                      <El />
                    </Suspense>
                  </RequireRole>
                );
                return [
                  ...(r.sub ?? []).map((s) => (
                    <Route key={`${r.key}/${s.path}`} path={`/${r.key}/${s.path}`} exact>{guard(s.element)}</Route>
                  )),
                  <Route key={r.key} path={`/${r.key}`} exact>{guard(r.list)}</Route>,
                ];
              })}
              <Route><NotFoundPage /></Route>
            </Switch>
          </AppLayout>
        </RequireAuth>
      </Route>
    </Switch>
  );
}
