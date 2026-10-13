import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
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
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : '/login'} replace />;
}

/** Route table: /login + the authenticated shell; every screen is wrapped in a role guard (SPEC §10). */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        {APP_ROUTES.map((r) => {
          const guard = (El: React.ComponentType) => (
            <RequireRole roles={r.roles}>
              <Suspense fallback={<Loading />}>
                <El />
              </Suspense>
            </RequireRole>
          );
          return [
            <Route key={r.key} path={r.key} element={guard(r.list)} />,
            ...(r.sub ?? []).map((s) => <Route key={`${r.key}/${s.path}`} path={`${r.key}/${s.path}`} element={guard(s.element)} />),
          ];
        })}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
