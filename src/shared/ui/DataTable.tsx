import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { paramName, parsePage, useQueryParams, type ParamUpdates } from '../router/listState';
import { UrlStateScope } from './urlStateScope';
import { Button } from './Button';
import { Input, Select } from './FormField';
import { EmptyState } from './EmptyState';
import { errorMessage } from '../api/errors';
import { SearchSelect } from './SearchSelect';
import type { SelectOption } from './FormField';
import { minimumTableWidth } from './tableLayout';

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
  options: (string | SelectOption)[];
  searchable?: boolean;
  value: (row: T) => string;
  /** Initial selection (default "Tất cả"). */
  initial?: string;
  /** Tên tham số URL; mặc định suy ra từ label (vd. "Trạng thái" → "trangthai"). */
  param?: string;
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
  subtitle?: ReactNode;
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  /** Toolbar buttons on the right of the title. */
  actions?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  rowActionHeader?: string;
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
  /**
   * Namespace tham số URL của bảng. Bắt buộc khi một màn hình có nhiều bảng
   * (vd. theo tab) để trạng thái từng bảng không lẫn nhau.
   */
  stateKey?: string;
  /** false: giữ trạng thái cục bộ, không ghi lên URL (bảng trong form). Bảng trong Modal/Drawer tự động là false. */
  urlState?: boolean;
}

const ALL = 'Tất cả';
/** Giá trị URL khi người dùng chọn "Tất cả" trong khi mặc định của bộ lọc là một giá trị khác. */
const ALL_TOKEN = '*';
const SEARCH_DEBOUNCE_MS = 350;

const optionValue = (o: string | SelectOption) => (typeof o === 'string' ? o : o.value);

/** "Trạng thái" → "trangthai": tên tham số ổn định, chỉ ký tự ASCII. */
function filterParamName<T>(f: FilterDef<T>): string {
  if (f.param) return f.param;
  const slug = f.label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  return slug || 'filter';
}

/**
 * Trạng thái tìm kiếm / bộ lọc / trang của bảng. Mặc định lưu trên URL (giữ nguyên khi mở chi tiết
 * rồi quay lại, tải lại trang, Back/Forward); dùng state cục bộ khi urlState = false hoặc nằm trong hộp thoại.
 */
function useTableState<T>(filters: FilterDef<T>[], persist: boolean, namespace: string | undefined) {
  const { params, setParams, hasRouter } = useQueryParams();
  const p = (key: string) => paramName(namespace, key);
  const defaultOf = (f: FilterDef<T>) => f.initial ?? ALL;

  const [localSearch, setLocalSearch] = useState('');
  const [localFv, setLocalFv] = useState<Record<string, string>>(() => Object.fromEntries(filters.map((f) => [f.label, defaultOf(f)])));
  const [localPage, setLocalPage] = useState(1);

  if (!persist || !hasRouter) {
    return {
      search: localSearch,
      fv: localFv,
      page: localPage,
      setSearch: (v: string) => {
        setLocalSearch(v);
        setLocalPage(1);
      },
      setFilter: (label: string, v: string) => {
        setLocalFv((s) => ({ ...s, [label]: v }));
        setLocalPage(1);
      },
      setPage: setLocalPage,
      clear: () => {
        setLocalSearch('');
        setLocalFv(Object.fromEntries(filters.map((f) => [f.label, ALL])));
        setLocalPage(1);
      },
    };
  }

  // Giá trị trên URL không thuộc danh sách lựa chọn → về mặc định.
  const fv: Record<string, string> = Object.fromEntries(
    filters.map((f) => {
      const raw = params.get(p(filterParamName(f)));
      if (raw === null) return [f.label, defaultOf(f)];
      if (raw === ALL_TOKEN) return [f.label, ALL];
      const values = f.options.map(optionValue);
      return [f.label, values.length > 0 && !values.includes(raw) ? defaultOf(f) : raw];
    }),
  );
  const encode = (f: FilterDef<T>, v: string) => (v === defaultOf(f) ? null : v === ALL ? ALL_TOKEN : v);

  return {
    search: params.get(p('q')) ?? '',
    fv,
    page: parsePage(params.get(p('page'))),
    setSearch: (v: string) => setParams({ [p('q')]: v, [p('page')]: null }),
    setFilter: (label: string, v: string) => {
      const f = filters.find((x) => x.label === label);
      if (f) setParams({ [p(filterParamName(f))]: encode(f, v), [p('page')]: null });
    },
    setPage: (n: number) => setParams({ [p('page')]: n > 1 ? n : null }),
    clear: () => {
      const updates: ParamUpdates = { [p('q')]: null, [p('page')]: null };
      for (const f of filters) updates[p(filterParamName(f))] = encode(f, ALL);
      setParams(updates);
    },
  };
}

/** Ô tìm kiếm phía server: gõ liên tục chỉ gửi một yêu cầu sau khi dừng gõ. */
function useDebouncedServerSearch(server: ServerPaging | undefined) {
  const external = server?.search ?? '';
  const [draft, setDraft] = useState(external);
  const sent = useRef(external);
  const onChange = server?.onSearchChange;

  // Giá trị đổi từ bên ngoài (Back/Forward, tải lại) → cập nhật ô nhập.
  useEffect(() => {
    if (external !== sent.current) {
      sent.current = external;
      setDraft(external);
    }
  }, [external]);

  useEffect(() => {
    if (!onChange || draft === sent.current) return;
    const t = window.setTimeout(() => {
      sent.current = draft;
      onChange(draft);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [draft, onChange]);

  const reset = () => {
    sent.current = '';
    setDraft('');
  };
  return { draft, setDraft, reset };
}

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
  subtitle,
  columns,
  rows,
  rowKey,
  loading,
  error,
  actions,
  rowActions,
  rowActionHeader = 'Thao tác',
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
  stateKey,
  urlState = true,
}: DataTableProps<T>) {
  const inUrlScope = useContext(UrlStateScope);
  const state = useTableState(filters, urlState && inUrlScope, stateKey);
  const { search, fv, page } = state;
  const serverSearch = useDebouncedServerSearch(server);

  const q = (server ? '' : search).trim().toLowerCase();
  const filtered = useMemo(() => {
    const all = rows ?? [];
    return all.filter((r) => {
      if (q && !columns.some((c) => cellText(c, r).toLowerCase().includes(q))) return false;
      return filters.every((f) => !fv[f.label] || fv[f.label] === ALL || f.value(r) === fv[f.label]);
    });
  }, [rows, q, fv, filters, columns]);

  const total = server ? server.total : filtered.length;
  const size = server ? server.size : pageSize;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const ready = !loading && rows !== undefined;
  // Trang đã lưu không còn tồn tại (dữ liệu thay đổi) → hiển thị trang hợp lệ gần nhất.
  const curPage = server ? server.page : ready ? Math.min(page, pageCount) : page;
  const serverPageChange = server?.onPageChange;
  const serverOutOfRange = !!server && ready && server.total > 0 && server.page > pageCount;
  useEffect(() => {
    if (serverOutOfRange) serverPageChange?.(pageCount);
  }, [serverOutOfRange, serverPageChange, pageCount]);
  const visible = server ? filtered : filtered.slice((curPage - 1) * size, curPage * size);
  const from = total === 0 ? 0 : (curPage - 1) * size + 1;
  const to = Math.min(total, curPage * size);
  const goto = (p: number) => (server ? server.onPageChange(p) : state.setPage(p));

  const clear = () => {
    state.clear();
    if (server) {
      serverSearch.reset();
      server.onSearchChange('');
    }
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
                value={server ? serverSearch.draft : search}
                onChange={(e) => (server ? serverSearch.setDraft(e.target.value) : state.setSearch(e.target.value))}
              />
            </label>
            {filters.map((f) => (
              <label className="lbl" key={f.label}>
                {f.label}
                {f.searchable ? <SearchSelect value={fv[f.label] ?? ALL} options={[ALL, ...f.options]} onChange={(v) => state.setFilter(f.label, v || ALL)} />
                  : <Select value={fv[f.label] ?? ALL} options={[ALL, ...f.options]} onChange={(e) => state.setFilter(f.label, e.target.value)} />}
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
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="spacer" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div>
              <span className="bold" style={{ fontSize: 15 }}>
                {title}
              </span>{' '}
              <span className="muted" style={{ fontSize: 13 }}>· {total} bản ghi</span>
            </div>
            {subtitle && (
              <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                {subtitle}
              </span>
            )}
          </div>
          {actions}
        </div>
      )}

      <section className="card tbl-wrap" style={{ minHeight: 120 }}>
        <table className="tbl" style={{ minWidth: minimumTableWidth(columns, rowActions ? rowActionsWidth : undefined) }}>
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
              {rowActions && <th style={{ textAlign: 'right' }}>{rowActionHeader}</th>}
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
