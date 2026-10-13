import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Input, Select } from './FormField';
import { EmptyState } from './EmptyState';
import { errorMessage } from '../api/errors';

export interface Column<T> {
  key: string;
  header: string;
  /** Cell content; defaults to text(row) or row[key]. */
  render?: (row: T) => ReactNode;
  /** Plain text used for search + filters + default render. */
  text?: (row: T) => string | number | null | undefined;
  /** CSS width ("140px", "18%"); columns without width share the rest. */
  width?: string;
  align?: 'left' | 'right' | 'center';
}

export interface FilterDef<T> {
  label: string;
  options: string[];
  value: (row: T) => string;
  /** Initial selection (default "Tất cả"). */
  initial?: string;
}

export interface ServerPaging {
  page: number;
  size: number;
  total: number;
  onPageChange: (page: number) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

interface DataTableProps<T> {
  title?: ReactNode;
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  /** Toolbar buttons on the right of the title. */
  actions?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  rowActionsWidth?: string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  searchPlaceholder?: string;
  /** false hides the "Advanced filter" card. */
  searchable?: boolean;
  filters?: FilterDef<T>[];
  /** Extra controls placed in the filter grid (e.g. date inputs). */
  filterExtra?: ReactNode;
  pageSize?: number;
  /** When set, paging/search are delegated to the server (?page=&size=&search=). Filters still apply client-side. */
  server?: ServerPaging;
  emptyText?: string;
}

const ALL = 'Tất cả';

const cellText = <T,>(c: Column<T>, row: T): string => {
  const v = c.text ? c.text(row) : (row as Record<string, unknown>)[c.key];
  return v == null ? '' : String(v);
};

/**
 * Generic list table used by every list screen: "Advanced filter" card (search + select filters),
 * title row with record count + actions, sticky-header table, row actions and paging – same layout as the prototype.
 */
export function DataTable<T>({
  title,
  columns,
  rows,
  rowKey,
  loading,
  error,
  actions,
  rowActions,
  rowActionsWidth = '220px',
  onRowClick,
  selectedKey,
  searchPlaceholder = 'Tìm kiếm…',
  searchable = true,
  filters = [],
  filterExtra,
  pageSize = 10,
  server,
  emptyText = 'Không có bản ghi phù hợp bộ lọc.',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [fv, setFv] = useState<Record<string, string>>(() => Object.fromEntries(filters.map((f) => [f.label, f.initial ?? ALL])));
  const [page, setPage] = useState(1);

  const q = (server ? '' : search).trim().toLowerCase();
  const filtered = useMemo(() => {
    const all = rows ?? [];
    return all.filter((r) => {
      if (q && !columns.some((c) => cellText(c, r).toLowerCase().includes(q))) return false;
      return filters.every((f) => !fv[f.label] || fv[f.label] === ALL || f.value(r) === fv[f.label]);
    });
  }, [rows, q, fv, filters, columns]);

  useEffect(() => setPage(1), [q, fv]);

  const total = server ? server.total : filtered.length;
  const size = server ? server.size : pageSize;
  const curPage = server ? server.page : page;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const visible = server ? filtered : filtered.slice((curPage - 1) * size, curPage * size);
  const from = total === 0 ? 0 : (curPage - 1) * size + 1;
  const to = Math.min(total, curPage * size);
  const goto = (p: number) => (server ? server.onPageChange(p) : setPage(p));

  const clear = () => {
    setSearch('');
    server?.onSearchChange('');
    setFv(Object.fromEntries(filters.map((f) => [f.label, ALL])));
  };

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - curPage) <= 2);

  return (
    <>
      {searchable && (
        <section className="card filter-card" aria-label="Advanced filter">
          <div className="row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14655B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 5h18l-7 8v6l-4 2v-8z" />
            </svg>
            <h2 className="sec">Advanced filter</h2>
          </div>
          <div className="filter-grid">
            <label className="lbl">
              Tìm kiếm
              <Input
                placeholder={searchPlaceholder}
                value={server ? server.search : search}
                onChange={(e) => (server ? server.onSearchChange(e.target.value) : setSearch(e.target.value))}
              />
            </label>
            {filters.map((f) => (
              <label className="lbl" key={f.label}>
                {f.label}
                <Select value={fv[f.label] ?? ALL} options={[ALL, ...f.options]} onChange={(e) => setFv((s) => ({ ...s, [f.label]: e.target.value }))} />
              </label>
            ))}
            {filterExtra}
            <div>
              <Button onClick={clear}>Xóa lọc</Button>
            </div>
          </div>
        </section>
      )}

      {(title || actions) && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div className="spacer">
            <span className="bold" style={{ fontSize: 15 }}>
              {title}
            </span>{' '}
            <span className="muted">· {total} bản ghi</span>
          </div>
          {actions}
        </div>
      )}

      <section className="card tbl-wrap" style={{ minHeight: 120 }}>
        <table className="tbl">
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={c.width ? { width: c.width } : undefined} />
            ))}
            {rowActions && <col style={{ width: rowActionsWidth }} />}
          </colgroup>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ textAlign: c.align ?? 'left' }} title={c.header}>
                  {c.header}
                </th>
              ))}
              {rowActions && <th style={{ textAlign: 'right' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const k = rowKey(r);
              return (
                <tr
                  key={k}
                  className={[onRowClick && 'clickable', selectedKey === k && 'selected'].filter(Boolean).join(' ')}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                      {c.render ? c.render(r) : cellText(c, r) || '—'}
                    </td>
                  ))}
                  {rowActions && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="actions">{rowActions(r)}</div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && (
          <div className="loading">
            <span className="spinner" /> Đang tải dữ liệu…
          </div>
        )}
        {!loading && error != null && <EmptyState title="Không tải được dữ liệu" description={errorMessage(error)} />}
        {!loading && error == null && visible.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', padding: 30, margin: 0 }}>
            {emptyText}
          </p>
        )}
      </section>

      <div className="pager">
        <span>
          Hiển thị {from}–{to} / {total}
        </span>
        <span className="pages">
          <Button size="sm" disabled={curPage <= 1} onClick={() => goto(curPage - 1)}>
            Trước
          </Button>
          {pages.map((p, i) => (
            <span key={p} style={{ display: 'inline-flex', gap: 6 }}>
              {i > 0 && p - pages[i - 1] > 1 && <span style={{ alignSelf: 'center' }}>…</span>}
              <Button size="sm" variant={p === curPage ? 'primary' : 'default'} onClick={() => goto(p)}>
                {p}
              </Button>
            </span>
          ))}
          <Button size="sm" disabled={curPage >= pageCount} onClick={() => goto(curPage + 1)}>
            Sau
          </Button>
        </span>
      </div>
    </>
  );
}
