import { Link } from '@/shared/router/compat';
import { listHref, RETURN_TO_LIST_STATE } from '@/shared/router/listState';

export interface BreadcrumbItem {
  label: string;
  to?: string;
  /** Quay về danh sách với bộ lọc / trang / vị trí cuộn đã dùng lần trước trong tab này. */
  restoreList?: boolean;
}

function target(item: BreadcrumbItem & { to: string }) {
  if (!item.restoreList) return item.to;
  const [pathname, search = ''] = listHref(item.to).split('?');
  return { pathname, search: search ? `?${search}` : '', state: RETURN_TO_LIST_STATE };
}

/** Shared header navigation for every Portal screen. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return <nav className="breadcrumbs" aria-label="Điều hướng trang">
    {items.map((item, index) => <span className="breadcrumb-item" key={`${item.label}-${index}`}>
      {index > 0 && <span className="breadcrumb-separator">/</span>}
      {item.to ? <Link to={target({ ...item, to: item.to })}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
    </span>)}
  </nav>;
}
