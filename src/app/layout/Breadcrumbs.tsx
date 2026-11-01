import { NavLink } from '@/shared/router/compat';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

/** Shared header navigation for every Portal screen. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return <nav className="breadcrumbs" aria-label="Điều hướng trang">
    {items.map((item, index) => <span className="breadcrumb-item" key={`${item.label}-${index}`}>
      {index > 0 && <span className="breadcrumb-separator">/</span>}
      {item.to ? <NavLink to={item.to}>{item.label}</NavLink> : <span aria-current="page">{item.label}</span>}
    </span>)}
  </nav>;
}
