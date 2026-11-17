/**
 * FSCM Web Portal – Reusable Pagination Controls Component
 * Phase 0: Foundation
 *
 * Thin adapter used by DataTable that maps CursorServerPaging / RestServerPaging
 * to the unified PaginationUIProps expected by the Pagination visual component.
 *
 * Direct consumers should use <Pagination /> for custom layouts.
 */

import type { ReactNode } from 'react';
import { Pagination } from './components/Pagination';
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
      onPage,
      isResolving = false,
    } = cursorPaging;

    return (
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={size}
        navigablePages={undefined}
        loading={loading || isResolving}
        hasPrev={pageInfo.hasPreviousPage}
        hasNext={pageInfo.hasNextPage}
        onPage={onPage ?? (onFirstPage ? (pg) => { if (pg === 1) onFirstPage(); } : () => {})}
        onPrev={onPrev}
        onNext={onNext}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={pageSizeOptions}
        extra={extra}
      />
    );
  }

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

    return (
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={total}
        pageSize={pageSize}
        navigablePages={undefined}
        loading={loading}
        hasPrev={currentPage > 1}
        hasNext={currentPage < totalPages}
        onPage={onPageChange}
        onPrev={() => onPageChange(currentPage - 1)}
        onNext={() => onPageChange(currentPage + 1)}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={pageSizeOptions}
        extra={extra}
      />
    );
  }

  return null;
}
