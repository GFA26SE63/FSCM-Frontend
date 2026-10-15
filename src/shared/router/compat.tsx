import type { ComponentProps, ReactNode } from 'react';
import {
  BrowserRouter,
  Link,
  NavLink as RouterNavLink,
  Redirect,
  Route,
  Switch,
  useHistory,
  useLocation,
  useParams as useRouterParams,
} from 'react-router-dom';

export { BrowserRouter, Link, Route, Switch, useLocation };

type NavigateOptions = { replace?: boolean; state?: unknown };
type NavigateTarget = string | number;

export function useNavigate() {
  const history = useHistory();
  return (target: NavigateTarget, options: NavigateOptions = {}) => {
    if (typeof target === 'number') {
      history.go(target);
      return;
    }
    const location = { pathname: target, state: options.state };
    if (options.replace) history.replace(location);
    else history.push(location);
  };
}

export function Navigate({ to, replace = false, state }: { to: string; replace?: boolean; state?: unknown }) {
  return <Redirect to={{ pathname: to, state }} push={!replace} />;
}

type CompatNavLinkProps = Omit<ComponentProps<typeof RouterNavLink>, 'className'> & {
  className?: string | ((state: { isActive: boolean }) => string);
  children?: ReactNode;
};

export function NavLink({ className, ...props }: CompatNavLinkProps) {
  return (
    <RouterNavLink
      {...props}
      className={typeof className === 'function' ? (isActive: boolean) => className({ isActive }) : className}
    />
  );
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>() {
  return useRouterParams<T>();
}
