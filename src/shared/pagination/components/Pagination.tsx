/**
 * FSCM Web Portal – Common Pagination UI Component
 *
 * Reusable visual pagination footer used by both REST and GraphQL cursor pagination.
 * Receives a unified PaginationUIProps interface — adapters (useRestPagination,
 * useCursorPagination) produce this interface; business pages do not handle
 * pagination strategy directly.
 *
 * Page indicators:
 * - navigablePages = undefined → all pages are clickable (REST mode).
 * - navigablePages = number[] → only listed pages are clickable (cursor mode;
 *   visited + adjacent pages only). Pages outside the list are shown as disabled
 *   reference indicators when totalPages is known.
 */

import type { ReactNode } from 'react';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/FormField';
import { DEFAULT_PAGE_SIZES } from '../types';

export interface PaginationUIProps {
  /** Current 1-based page number. */
  currentPage: number;
  /** Total pages if known. */
  totalPages?: number;
  /** Total record count if known. */
  totalCount?: number;
  /** Current page size. */
  pageSize: number;
  /** Actual rows on this page, including an empty/stale cursor page. */
  itemCount?: number;
  /**
   * Pages reachable by direct navigation.
   * - undefined → all pages are navigable (REST mode).
   * - number[] → only the listed page numbers are navigable (cursor mode).
   *   Pages not in this list render as disabled reference indicators.
   */
  navigablePages?: number[];
  loading?: boolean;
  /** Whether backward navigation is available. */
  hasPrev: boolean;
  /** Whether forward navigation is available. */
  hasNext: boolean;
  /** Navigate directly to a specific page number. */
  onPage: (page: number) => void;
  /** Navigate to the previous page. */
  onPrev: () => void;
  /** Navigate to the next page. */
  onNext: () => void;
  /** Change the page size. */
  onPageSizeChange?: (size: number) => void;
  /** Allowed page size options. */
  pageSizeOptions?: readonly number[];
  pageSizeLabel?: string;
  /** Extra content on the left side of the pager. */
  extra?: ReactNode;
}

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  itemCount,
  navigablePages,
  loading = false,
  hasPrev,
  hasNext,
  onPage,
  onPrev,
  onNext,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  pageSizeLabel = 'Số dòng mỗi trang',
  extra,
}: PaginationUIProps) {
  const hasTotal = totalCount !== undefined && totalCount >= 0;
  const from = (hasTotal && totalCount === 0) || itemCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = hasTotal ? itemCount === 0 ? 0 : Math.min(totalCount!, (currentPage - 1) * pageSize + (itemCount ?? pageSize)) : undefined;

  // null = all pages navigable (REST); Set = cursor-limited navigable set
  const navigableSet: Set<number> | null = navigablePages ? new Set(navigablePages) : null;

  // Which page number indicators to show.
  // With totalPages known: compact window (1, last, ±2 from current) — same as REST mode.
  // Without totalPages: show only the pages we know about.
  let candidates: number[];
  if (totalPages) {
    candidates = [...new Set([1, totalPages, currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2])]
      .filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  } else {
    const known = new Set<number>([1, currentPage]);
    if (navigablePages) for (const p of navigablePages) known.add(p);
    candidates = [...known].sort((a, b) => a - b);
  }

  return (
    <div className="pager" role="navigation" aria-label="Phân trang dữ liệu">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>
          {hasTotal ? `Hiển thị ${from}–${to} / ${totalCount}` : `Trang ${currentPage}`}
        </span>
        {extra}
      </div>

      <span className="pages" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {onPageSizeChange && (
          <Select
            className="pagination-page-size"
            aria-label={pageSizeLabel}
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            options={pageSizeOptions.map((n) => ({ value: String(n), label: `${n} / trang` }))}
          />
        )}

        <Button
          size="sm"
          disabled={!hasPrev || loading}
          onClick={onPrev}
          aria-label="Trang trước"
        >
          Trước
        </Button>

        {candidates.map((p, i) => {
          const isActive = p === currentPage;
          const isNavigable = !isActive && (navigableSet === null || navigableSet.has(p));
          return (
            <span key={p} style={{ display: 'inline-flex', gap: 6 }}>
              {i > 0 && p - candidates[i - 1] > 1 && (
                <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--color-text, #333)' }}>
                  …
                </span>
              )}
              <Button
                size="sm"
                variant={isActive ? 'primary' : 'default'}
                disabled={loading || (!isNavigable && !isActive)}
                onClick={isNavigable ? () => onPage(p) : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                {p}
              </Button>
            </span>
          );
        })}

        <Button
          size="sm"
          disabled={!hasNext || loading}
          onClick={onNext}
          aria-label="Trang sau"
        >
          Sau
        </Button>
      </span>
    </div>
  );
}
