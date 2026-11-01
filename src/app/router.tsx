import { Suspense } from 'react';
import { Navigate, Route, Switch } from '@/shared/router/compat';
import { RequireAuth, RequireRole } from '@/shared/auth/guards';
import { useAuth } from '@/shared/auth/AuthContext';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { APP_ROUTES, HOME_BY_ROLE } from './routes';

const Loading = () => (
  <div className="loading">
    <span className="spinner" /> Đang tải màn hình…
  </div>
);

function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? (HOME_BY_ROLE[user.role] || '/dashboard') : '/login'} replace />;
}

/** Route table: /login + the authenticated shell; every screen is wrapped in a role guard (SPEC §10). */
export function AppRouter() {
  return (
    <Switch>
      <Route path="/login" exact><LoginPage /></Route>
      <Route path="/">
        <RequireAuth>
          <AppLayout>
            <Switch>
              <Route path="/" exact><Home /></Route>
              {APP_ROUTES.flatMap((r) => {
                const guard = (El: React.ComponentType) => (
                  <RequireRole roles={r.roles}>
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
