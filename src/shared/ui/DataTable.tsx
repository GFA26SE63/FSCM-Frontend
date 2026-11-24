import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { paramName, parsePage, useQueryParams, type ParamUpdates } from '../router/listState';
import { UrlStateScope } from './urlStateScope';
import { Button } from './Button';
import { Input, Select } from './FormField';
import { EmptyState } from './EmptyState';
import { errorMessage } from '../api/errors';
import { SearchSelect } from './SearchSelect';
import type { SelectOption } from './FormField';
import { listColumns as selectListColumns } from './tableColumns';
import { DEFAULT_PAGE_SIZES } from '../pagination/types';
import { tableFilterParam, tableFilterValue } from './tableFilterLabels';
import type { CursorServerPaging, RestServerPaging, ServerPaging, ServerSort, SortDirection } from '../pagination/types';
import { PaginationControls } from '../pagination/PaginationControls';
import { downloadExcel } from '../lib/excel';

export type { ServerPaging, CursorServerPaging, RestServerPaging, ServerSort, SortDirection };

export interface Column<T> {
  key: string;
  header: string;
  /** Cell content; defaults to text(row) or row[key]. */
  render?: (row: T) => ReactNode;
  /** Plain text used for search + filters + default render. */
  text?: (row: T) => string | number | null | undefined;
  /** CSS width ("140px", "18%"); columns without width share the rest. */
  width?: string;
  /** Optional compact-list width; legacy widths are not forced onto the fitted list. */
  summaryWidth?: string;
  align?: 'left' | 'right' | 'center';
  /** Whether this column supports server-side sorting via ServerSort. */
  sortable?: boolean;
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

interface DataTableProps<T> {
  title?: ReactNode;
  subtitle?: ReactNode;
  columns: Column<T>[];
  /** Keys chosen by this feature for its list; all columns remain available to search, sort and export. */
  summaryColumns?: readonly string[];
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
  /** Keep every cell on one line; the table scrolls horizontally instead of wrapping. */
  nowrap?: boolean;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  /** When set, paging/search are delegated to REST server (?page=&size=&search=). Filters still apply client-side. */
  server?: ServerPaging | RestServerPaging;
  /** When set, paging/search are delegated to GraphQL Relay cursor pagination. */
  cursor?: CursorServerPaging;
  /** When set, table headers become sortable triggers integrated with server-side sorting. */
  serverSort?: ServerSort;
  emptyText?: string;
  /**
   * Namespace tham số URL của bảng. Bắt buộc khi một màn hình có nhiều bảng
   * (vd. theo tab) để trạng thái từng bảng không lẫn nhau.
   */
  stateKey?: string;
  /** false: giữ trạng thái cục bộ, không ghi lên URL (bảng trong form). Bảng trong Modal/Drawer tự động là false. */
  urlState?: boolean;
  /** Enables a consistent Excel export of the currently filtered table rows. */
  excelFileName?: string;
}

const ALL = 'Tất cả';
/** Giá trị URL khi người dùng chọn "Tất cả" trong khi mặc định của bộ lọc là một giá trị khác. */
const ALL_TOKEN = '*';
const SEARCH_DEBOUNCE_MS = 350;

const optionValue = (o: string | SelectOption) => (typeof o === 'string' ? o : o.value);

/** "Trạng thái" → "trangthai": tên tham số ổn định, chỉ ký tự ASCII. */
function filterParamName<T>(f: FilterDef<T>): string {
  if (f.param) return f.param;
  return tableFilterParam(f.label);
}

/**
 * Trạng thái tìm kiếm / bộ lọc / trang của bảng. Mặc định lưu trên URL (giữ nguyên khi mở chi tiết
 * rồi quay lại, tải lại trang, Back/Forward); dùng state cục bộ khi urlState = false hoặc nằm trong hộp thoại.
 */
function useTableState<T>(filters: FilterDef<T>[], persist: boolean, namespace: string | undefined, defaultSize: number, sizes: readonly number[]) {
  const { params, setParams, hasRouter } = useQueryParams();
  const p = (key: string) => paramName(namespace, key);
  const defaultOf = (f: FilterDef<T>) => f.initial ?? ALL;

  const [localSearch, setLocalSearch] = useState('');
  const [localFv, setLocalFv] = useState<Record<string, string>>(() => Object.fromEntries(filters.map((f) => [f.label, defaultOf(f)])));
  const [localPage, setLocalPage] = useState(1);
  const [localSize, setLocalSize] = useState(defaultSize);

  if (!persist || !hasRouter) {
    return {
      search: localSearch,
      fv: localFv,
      page: localPage,
      size: localSize,
      setSize: (size: number) => { setLocalSize(size); setLocalPage(1); },
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
      const normalized = tableFilterValue(raw, values);
      return [f.label, values.length > 0 && !values.includes(normalized) ? defaultOf(f) : normalized];
    }),
  );
  const encode = (f: FilterDef<T>, v: string) => (v === defaultOf(f) ? null : v === ALL ? ALL_TOKEN : v);

  return {
    search: params.get(p('q')) ?? '',
    fv,
    page: parsePage(params.get(p('page'))),
    size: sizes.includes(Number(params.get(p('size')))) ? Number(params.get(p('size'))) : defaultSize,
    setSize: (size: number) => setParams({ [p('size')]: size, [p('page')]: null }),
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
function useDebouncedSearch(external: string | undefined, onChange: ((search: string) => void) | undefined) {
  const safeExternal = external ?? '';
  const [draft, setDraft] = useState(safeExternal);
  const sent = useRef(safeExternal);

  // Giá trị đổi từ bên ngoài (Back/Forward, tải lại) → cập nhật ô nhập.
  useEffect(() => {
    if (safeExternal !== sent.current) {
      sent.current = safeExternal;
      setDraft(safeExternal);
    }
  }, [safeExternal]);

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
 * title row with record count + actions, sticky-header table, row actions and paging – supporting:
 * 1. Client-side pagination (default)
 * 2. REST server-side pagination (`server` prop)
 * 3. GraphQL cursor pagination (`cursor` prop)
 * 4. Server-side sorting (`serverSort` prop)
 */
export function DataTable<T>({
  title,
  subtitle,
  columns,
  summaryColumns,
  rows,
  rowKey,
  loading = false,
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
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  server,
  cursor,
  serverSort,
  emptyText = 'Không có bản ghi phù hợp bộ lọc.',
  stateKey,
  urlState = true,
  nowrap = false,
  excelFileName,
}: DataTableProps<T>) {
  const inUrlScope = useContext(UrlStateScope);
  const effectiveExcelFileName = excelFileName ?? (typeof title === 'string' ? title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'danh-sach');
  const state = useTableState(filters, urlState && inUrlScope, stateKey, pageSize, pageSizeOptions);
  const { search, fv, page } = state;
  const listColumns = selectListColumns(columns, summaryColumns, c => c.key);
  const hasSecondaryColumns = listColumns.length < columns.length;
  const viewActions = rowActions;

  // Active pagination mode
  const mode: 'client' | 'rest' | 'cursor' = cursor ? 'cursor' : server ? 'rest' : 'client';

  // Server/cursor search debounce
  const activeSearchValue = cursor ? cursor.search : server?.search;
  const activeSearchChange = cursor ? cursor.onSearchChange : server?.onSearchChange;
  const serverSearch = useDebouncedSearch(activeSearchValue, activeSearchChange);

  // Client-side filtering (when not in cursor mode)
  const q = (mode === 'client' ? search : '').trim().toLowerCase();
  const filtered = useMemo(() => {
    const all = rows ?? [];
    if (mode === 'cursor') return all; // Cursor mode data is already sliced and filtered by GraphQL
    return all.filter((r) => {
      if (q && !columns.some((c) => cellText(c, r).toLowerCase().includes(q))) return false;
      return filters.every((f) => !fv[f.label] || fv[f.label] === ALL || f.value(r) === fv[f.label]);
    });
  }, [rows, q, fv, filters, columns, mode]);

  // Derived totals and page sizes
  const total = cursor
    ? cursor.totalCount ?? rows?.length ?? 0
    : server
      ? server.total
      : filtered.length;

  const size = cursor ? cursor.size : server ? server.size : state.size;
  const pageCount = Math.max(1, Math.ceil(total / (size || 1)));
  const ready = !loading && rows !== undefined;
  const [exporting, setExporting] = useState(false);
  const exportExcel = async () => {
    if (!effectiveExcelFileName) return;
    setExporting(true);
    try {
      await downloadExcel(`${effectiveExcelFileName}.xlsx`, [{ name: 'Dữ liệu', title: typeof title === 'string' ? title : 'Danh sách dữ liệu', blocks: [{ columns: columns.map(c => ({ header: c.header })), rows: filtered.map(row => columns.map(c => cellText(c, row))) }] }]);
    } finally { setExporting(false); }
  };

  // Ensure current page is within valid range for REST mode
  const curPage = cursor
    ? cursor.currentPage
    : server
      ? server.page
      : ready
        ? Math.min(page, pageCount)
        : page;

  const serverPageChange = server?.onPageChange;
  const serverOutOfRange = !!server && ready && server.total > 0 && server.page > pageCount;
  useEffect(() => {
    if (serverOutOfRange) serverPageChange?.(pageCount);
  }, [serverOutOfRange, serverPageChange, pageCount]);

  // Determine rows to render
  const visible = mode === 'cursor'
    ? rows ?? []
    : mode === 'rest'
      ? filtered
      : filtered.slice((curPage - 1) * size, curPage * size);

  const goto = (p: number) => {
    if (server) server.onPageChange(p);
    else state.setPage(p);
  };

  const clear = () => {
    state.clear();
    if (cursor) {
      serverSearch.reset();
      cursor.onSearchChange?.('');
      cursor.onFirstPage?.();
    } else if (server) {
      serverSearch.reset();
      server.onSearchChange?.('');
      server.onPageChange(1);
    }
  };

  // Stale cursor: propagated from useCursorPagination only when backend confirms HC0078.
  const isStaleCursor = cursor?.isStaleCursor ?? false;

  return (
    <>
      {searchable && (
        <section className="card filter-card" aria-label="Bộ lọc nâng cao">
          <div className="row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14655B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 5h18l-7 8v6l-4 2v-8z" />
            </svg>
            <h2 className="sec">Bộ lọc nâng cao</h2>
          </div>
          <div className="filter-grid">
            <label className="lbl">
              Tìm kiếm
              <Input
                placeholder={searchPlaceholder}
                value={mode !== 'client' ? serverSearch.draft : search}
                onChange={(e) =>
                  mode !== 'client' ? serverSearch.setDraft(e.target.value) : state.setSearch(e.target.value)
                }
              />
            </label>
            {filters.map((f) => (
              <label className="lbl" key={f.label}>
                {f.label}
                {f.searchable ? (
                  <SearchSelect value={fv[f.label] ?? ALL} options={[ALL, ...f.options]} onChange={(v) => state.setFilter(f.label, v || ALL)} />
                ) : (
                  <Select value={fv[f.label] ?? ALL} options={[ALL, ...f.options]} onChange={(e) => state.setFilter(f.label, e.target.value)} />
                )}
              </label>
            ))}
            {filterExtra}
            <div>
              <Button onClick={clear}>Xóa lọc</Button>
            </div>
          </div>
        </section>
      )}

      {(title || actions || effectiveExcelFileName) && (
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="spacer" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div>
              <span className="bold" style={{ fontSize: 15 }}>
                {title}
              </span>
            </div>
            {subtitle && (
              <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                {subtitle}
              </span>
            )}
          </div>
          {effectiveExcelFileName && <Button loading={exporting} disabled={!ready || filtered.length === 0} onClick={() => void exportExcel()}>Xuất Excel</Button>}
          {actions}
        </div>
      )}

      {hasSecondaryColumns && serverSort && <label className="lbl" style={{ marginBottom: 12 }}>Sắp xếp danh sách
        <Select value={serverSort.field && serverSort.direction ? `${serverSort.field}:${serverSort.direction}` : ''}
          onChange={e => { const [field, direction] = e.target.value.split(':'); serverSort.onChange(field || serverSort.field || columns[0].key, direction as SortDirection | undefined); }}
          options={[{ value: '', label: 'Mặc định' }, ...columns.filter(c => c.sortable || serverSort.sortableFields?.includes(c.key)).flatMap(c => [
            { value: `${c.key}:asc`, label: `${c.header} · tăng dần` }, { value: `${c.key}:desc`, label: `${c.header} · giảm dần` },
          ])]} />
      </label>}
      <section className={`card tbl-wrap table-fit${nowrap ? ' table-fit-requested-nowrap' : ''}`} style={{ minHeight: 120 }}>
        <table className="tbl">
          <colgroup>
            {listColumns.map((c) => (
              <col key={c.key} style={c.summaryWidth ? { width: c.summaryWidth } : undefined} />
            ))}
            {viewActions && <col style={{ width: rowActionsWidth }} />}
          </colgroup>
          <thead>
            <tr>
              {listColumns.map((c) => {
                const isSortable = Boolean(
                  c.sortable || (serverSort?.sortableFields && serverSort.sortableFields.includes(c.key)),
                );
                const isCurrentSort = serverSort?.field === c.key;
                const direction = isCurrentSort ? serverSort?.direction : undefined;

                if (serverSort && isSortable) {
                  const handleSortToggle = () => {
                    let nextDir: SortDirection | undefined;
                    if (!isCurrentSort) nextDir = 'asc';
                    else if (direction === 'asc') nextDir = 'desc';
                    else nextDir = undefined;
                    serverSort.onChange(c.key, nextDir);
                  };

                  return (
                    <th
                      key={c.key}
                      style={{ textAlign: c.align ?? 'left', cursor: 'pointer', userSelect: 'none' }}
                      title={`${c.header} (Nhấp để sắp xếp)`}
                      onClick={handleSortToggle}
                      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {c.header}
                        <span style={{ fontSize: '11px', color: direction ? '#14655B' : '#999' }}>
                          {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '⇅'}
                        </span>
                      </span>
                    </th>
                  );
                }

                return (
                  <th key={c.key} style={{ textAlign: c.align ?? 'left' }} title={c.header}>
                    {c.header}
                  </th>
                );
              })}
              {viewActions && <th style={{ textAlign: 'right' }}>{rowActionHeader}</th>}
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
                  {listColumns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                      {c.render ? c.render(r) : cellText(c, r) || '—'}
                    </td>
                  ))}
                  {viewActions && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="actions">{viewActions(r)}</div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {loading && (
          <div className="loading" role="status" aria-live="polite">
            <span className="spinner" /> Đang tải dữ liệu…
          </div>
        )}

        {!loading && isStaleCursor && (
          <div style={{ textAlign: 'center', padding: '30px 16px' }}>
            <p className="muted" style={{ margin: 0, marginBottom: 12 }}>
              Trang đã chọn không còn dữ liệu do hệ thống đã cập nhật.
            </p>
            {cursor?.onFirstPage && (
              <Button size="sm" variant="primary" onClick={cursor.onFirstPage}>
                Về trang đầu
              </Button>
            )}
          </div>
        )}

        {!loading && !isStaleCursor && error != null && (
          <EmptyState title="Không tải được dữ liệu" description={errorMessage(error)} />
        )}

        {!loading && !isStaleCursor && error == null && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 16px' }}>
            <p className="muted" style={{ margin: 0 }}>{emptyText}</p>
          </div>
        )}
      </section>

      {/* Unified Pagination Controls */}
      <PaginationControls
        mode={mode}
        restPaging={
          mode !== 'cursor'
            ? {
                currentPage: curPage,
                pageSize: size,
                total,
                totalPages: pageCount,
                onPageChange: goto,
                onPageSizeChange: mode === 'client' ? state.setSize : server?.onPageSizeChange,
                pageSizeOptions: server?.pageSizeOptions ?? pageSizeOptions,
                loading,
              }
            : undefined
        }
        cursorPaging={cursor}
      />
    </>
  );
}
