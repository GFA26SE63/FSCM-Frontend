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

function parseTarget(target: string, state?: unknown) {
  const [pathWithoutSearch, searchPart] = target.split('?');
  const [pathname, hashPart] = pathWithoutSearch.split('#');
  const search = searchPart ? `?${searchPart.split('#')[0]}` : '';
  const hash = hashPart
    ? `#${hashPart}`
    : searchPart && searchPart.includes('#')
      ? `#${searchPart.split('#')[1]}`
      : '';
  return { pathname, search, hash, state };
}

export function useNavigate() {
  const history = useHistory();
  return (target: NavigateTarget, options: NavigateOptions = {}) => {
    if (typeof target === 'number') {
      history.go(target);
      return;
    }
    const location = parseTarget(target, options.state);
    if (options.replace) history.replace(location);
    else history.push(location);
  };
}

export function Navigate({ to, replace = false, state }: { to: string; replace?: boolean; state?: unknown }) {
  const location = parseTarget(to, state);
  return <Redirect to={location} push={!replace} />;
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
