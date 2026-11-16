/**
 * FSCM Web Portal – Reusable Pagination Controls Component
 * Phase 0: Foundation
 *
 * Provides a standardized footer toolbar for:
 * 1. Numbered pages (Client-side & REST server-side).
 * 2. Cursor navigation (GraphQL Relay-style Next/Prev).
 * 3. Page size selector with standard Vietnamese business labels.
 * 4. Record count range ("Hiển thị X–Y / Z").
 */

import type { ReactNode } from 'react';
import { Button } from '../ui/Button';
import { Select } from '../ui/FormField';
import { DEFAULT_PAGE_SIZES, type CursorServerPaging } from './types';

export interface PaginationControlsProps {
  /** Mode: 'rest', 'cursor', or 'client'. */
  mode: 'client' | 'rest' | 'cursor';
  /** Numbered pagination props (for client and REST modes). */
  restPaging?: {
    currentPage: number;
    pageSize: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: readonly number[];
    loading?: boolean;
  };
  /** Cursor pagination props (for GraphQL mode). */
  cursorPaging?: CursorServerPaging;
  /** Custom extra elements to display on the left side of the pager. */
  extra?: ReactNode;
}

export function PaginationControls({ mode, restPaging, cursorPaging, extra }: PaginationControlsProps) {
  if (mode === 'cursor' && cursorPaging) {
    const {
      pageInfo,
      currentPage,
      size,
      totalCount,
      totalPages,
      onNext,
      onPrev,
      onFirstPage,
      onPageSizeChange,
      pageSizeOptions = DEFAULT_PAGE_SIZES,
      loading = false,
    } = cursorPaging;

    // Derived record range if totalCount is available
    const hasTotal = totalCount !== undefined && totalCount >= 0;
    const from = hasTotal && totalCount === 0 ? 0 : (currentPage - 1) * size + 1;
    const to = hasTotal ? Math.min(totalCount, currentPage * size) : undefined;

    // Build page indicators using only cursors we actually have.
    // Cursor pagination cannot jump to arbitrary pages — only prev/next/first are safe.
    interface CursorPageIndicator {
      page: number;
      onClick: (() => void) | undefined; // undefined = not navigable (shown disabled)
      active: boolean;
    }
    const indicators: CursorPageIndicator[] = [];

    // Page 1 — always reachable via onFirstPage
    if (currentPage > 1) {
      indicators.push({ page: 1, onClick: onFirstPage, active: false });
    }
    // currentPage-1 — reachable via onPrev (only when it's not already page 1)
    if (currentPage > 2 && pageInfo.hasPreviousPage) {
      indicators.push({ page: currentPage - 1, onClick: onPrev, active: false });
    }
    // Current page — always shown as active
    indicators.push({ page: currentPage, onClick: undefined, active: true });
    // currentPage+1 — reachable via onNext
    if (pageInfo.hasNextPage) {
      indicators.push({ page: currentPage + 1, onClick: onNext, active: false });
    }
    // Last page — shown as a non-navigable indicator when known and not already shown
    if (totalPages && currentPage + 1 < totalPages) {
      indicators.push({ page: totalPages, onClick: undefined, active: false });
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
              aria-label="Số dòng mỗi trang"
              value={String(size)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              options={pageSizeOptions.map((n) => ({ value: String(n), label: `${n} / trang` }))}
            />
          )}

          <Button
            size="sm"
            disabled={!pageInfo.hasPreviousPage || loading}
            onClick={onPrev}
            aria-label="Trang trước"
          >
            Trước
          </Button>

          {indicators.map((ind, i) => (
            <span key={ind.page} style={{ display: 'inline-flex', gap: 6 }}>
              {i > 0 && ind.page - indicators[i - 1].page > 1 && (
                <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--color-text, #333)' }}>…</span>
              )}
              <Button
                size="sm"
                variant={ind.active ? 'primary' : 'default'}
                disabled={loading || (!ind.onClick && !ind.active)}
                onClick={ind.onClick}
                aria-current={ind.active ? 'page' : undefined}
              >
                {ind.page}
              </Button>
            </span>
          ))}

          <Button
            size="sm"
            disabled={!pageInfo.hasNextPage || loading}
            onClick={onNext}
            aria-label="Trang sau"
          >
            Sau
          </Button>
        </span>
      </div>
    );
  }

  // Client-side and REST Server-side mode
  if (restPaging) {
    const {
      currentPage,
      pageSize,
      total,
      totalPages,
      onPageChange,
      onPageSizeChange,
      pageSizeOptions = DEFAULT_PAGE_SIZES,
      loading = false,
    } = restPaging;

    const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const to = Math.min(total, currentPage * pageSize);

    // Filter visible page numbers (page 1, last page, and +/- 2 from current page)
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
      (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2,
    );

    return (
      <div className="pager" role="navigation" aria-label="Phân trang dữ liệu">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>
            Hiển thị {from}–{to} / {total}
          </span>
          {extra}
        </div>

        <span className="pages" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {onPageSizeChange && (
            <Select
              aria-label="Số dòng mỗi trang"
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              options={pageSizeOptions.map((n) => ({ value: String(n), label: `${n} / trang` }))}
            />
          )}

          <Button
            size="sm"
            disabled={currentPage <= 1 || loading}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Trang trước"
          >
            Trước
          </Button>

          {pages.map((p, i) => (
            <span key={p} style={{ display: 'inline-flex', gap: 6 }}>
              {i > 0 && p - pages[i - 1] > 1 && <span style={{ alignSelf: 'center' }}>…</span>}
              <Button
                size="sm"
                variant={p === currentPage ? 'primary' : 'default'}
                disabled={loading}
                onClick={() => onPageChange(p)}
                aria-current={p === currentPage ? 'page' : undefined}
              >
                {p}
              </Button>
            </span>
          ))}

          <Button
            size="sm"
            disabled={currentPage >= totalPages || loading}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Trang sau"
          >
            Sau
          </Button>
        </span>
      </div>
    );
  }

  return null;
}
