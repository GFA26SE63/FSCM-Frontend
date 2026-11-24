import { useEffect, useState, type ReactNode } from 'react';
import { Eye } from 'lucide-react';
import { Button } from './Button';
import { listColumns as selectListColumns } from './tableColumns';
import { Pagination } from '../pagination/components/Pagination';

export interface SimpleColumn<T> {
  header: string;
  cell: (row: T, index: number) => ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
}

/** Feature-owned list columns and optional paging of already-loaded rows. */
export function SimpleTable<T>({ columns, summaryColumns, rows, empty = 'Không có dữ liệu.', compact, footer, onRowClick, paginate = true, resetPageKey }: {
  columns: SimpleColumn<T>[];
  /** Headers of essential columns. The owning feature provides its existing view action. */
  summaryColumns?: readonly string[];
  rows: T[];
  empty?: string;
  compact?: boolean;
  /** One cell per column, rendered as a bold totals row under the rows. */
  footer?: ReactNode[];
  /** Makes every data row open its corresponding detail view. */
  onRowClick?: (row: T) => void;
  /** For an already-loaded list. Server-paged lists supply their own paging controls. */
  paginate?: boolean;
  /** Reset to the first page when a feature filter changes; retain the chosen page size. */
  resetPageKey?: string;
}) {
  const listColumns = selectListColumns(columns, summaryColumns, c => c.header).map(column => ({ column, index: columns.indexOf(column) }));
  const hasDetails = listColumns.length < columns.length;
  const showView = !!onRowClick && !listColumns.some(({ column }) => /thao tác/i.test(column.header));
  const [size, setSize] = useState(10);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetPageKey]);
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, totalPages);
  const offset = paginate ? (current - 1) * size : 0;
  const visibleRows = paginate ? rows.slice(offset, offset + size) : rows;
  return (
    <>
    <div className="tbl-wrap table-fit">
      <table className={`tbl${compact ? ' compact' : ''}`}>
        <colgroup>
          {listColumns.map(({ column: c, index }) => (
            <col key={index} style={/thao tác/i.test(c.header) ? { width: c.width || 180 } : /^chọn$/i.test(c.header) ? { width: 60 } : undefined} />
          ))}
          {showView && <col style={{ width: 100 }} />}
        </colgroup>
        <thead>
          <tr>
            {listColumns.map(({ column: c, index: i }) => (
              <th key={i} style={{ textAlign: c.align ?? 'left' }} title={c.header}>
                {c.header}
              </th>
            ))}
            {showView && <th style={{ textAlign: 'right' }}>Thao tác</th>}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((r, ri) => (
            <tr
              key={ri}
              className={onRowClick ? 'clickable' : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onRowClick(r); } } : undefined}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
            >
              {listColumns.map(({ column: c, index: ci }) => (
                <td key={ci} style={{ textAlign: c.align ?? 'left' }}>
                  {c.cell(r, ri + offset)}
                </td>
              ))}
              {showView && <td style={{ textAlign: 'right' }}><Button size="sm" onClick={e => { e.stopPropagation(); onRowClick?.(r); }}><Eye size={14} /> Xem</Button></td>}
            </tr>
          ))}
        </tbody>
        {footer && rows.length > 0 && (
          <tfoot>
            <tr className="tbl-total">
              {listColumns.map(({ column: c, index: i }) => (
                <td key={i} style={{ textAlign: c.align ?? 'left' }}>
                  {footer[i]}
                </td>
              ))}
              {showView && <td />}
            </tr>
          </tfoot>
        )}
      </table>
      {rows.length === 0 && <p className="muted" style={{ margin: '10px 14px' }}>{empty}</p>}
    </div>
    {footer && hasDetails && <details><summary>Tổng hợp tất cả bản ghi</summary><dl className="table-detail-fields">
      {columns.map((c, i) => <div key={i}><dt>{c.header || 'Tổng'}</dt><dd>{footer[i]}</dd></div>)}
    </dl></details>}
    {paginate && <Pagination currentPage={current} pageSize={size} totalCount={rows.length} totalPages={totalPages}
      hasPrev={current > 1} hasNext={current < totalPages} onPage={setPage}
      onPrev={() => setPage(current - 1)} onNext={() => setPage(current + 1)}
      onPageSizeChange={value => { setSize(value); setPage(1); }} />}
    </>
  );
}
