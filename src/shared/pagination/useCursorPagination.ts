/**
 * FSCM Web Portal – Reusable GraphQL Cursor Pagination Hook
 * Phase 0: Foundation
 *
 * Provides a standardized, robust cursor navigation hook supporting:
 * 1. Bidirectional GraphQL cursor navigation synchronized with URL query params
 *    (as demonstrated in `/runpicking`).
 * 2. In-memory Cursor Stack navigation for dialogs, drawers, and nested panels
 *    (as demonstrated in `UserAuditPanel`).
 * 3. Opaque cursor handling (never decodes or assumes keyset representation).
 * 4. Stale/Invalid cursor recovery: detects when a cursor yields no records
 *    and provides a safe return to page 1.
 * 5. Automatic resets: clearing cursors whenever filters, search, sort, or page-size change.
 */

import { useCallback, useState } from 'react';
import { paramName, parsePage, useQueryParams } from '../router/listState';
import { ApiError } from '../api/errors';
import { DEFAULT_PAGE_SIZES, type CursorServerPaging, type PageInfo, type ServerSort, type SortDirection } from './types';
import { decodeSort, encodeSort, PAGINATION_PARAM_NAMES, parsePageSize } from './urlSync';

/** Returns true only when the backend explicitly reports an invalid/expired cursor (HC0078). */
function isInvalidCursorError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'HC0078';
}

export interface UseCursorPaginationOptions {
  /** PageInfo returned by the GraphQL query. */
  pageInfo?: PageInfo;
  /** Total count returned by the GraphQL query, if supported by the schema. */
  totalCount?: number;
  /** Number of items returned in the current page (used to detect stale cursor). */
  itemCount?: number;
  /** Default page size if not specified in URL. Default: 10. */
  defaultPageSize?: number;
  /** Allowed page size options. Default: [10, 20, 50]. */
  pageSizeOptions?: readonly number[];
  /** Optional namespace for URL query parameters (e.g. for multi-table screens). */
  stateKey?: string;
  /**
   * Whether to sync state to the URL.
   * If false, uses in-memory Cursor Stack mode (ideal for dialogs like UserAuditPanel).
   * Default: true.
   */
  urlState?: boolean;
  /** Optional initial sort configuration. */
  initialSort?: { field: string; direction?: SortDirection };
  /** Query loading indicator. */
  loading?: boolean;
  /** Query error. */
  error?: unknown;
}

export interface UseCursorPaginationResult {
  /** The opaque cursor to pass as `after` to the GraphQL query (forward pagination). */
  after?: string;
  /** The opaque cursor to pass as `before` to the GraphQL query (backward pagination). */
  before?: string;
  /** Current 1-based page number. */
  currentPage: number;
  /** Current page size. */
  pageSize: number;
  /** Total pages, derivable if totalCount is available. */
  totalPages?: number;
  /** Current search query string. */
  search: string;
  /** Current sort configuration if applicable. */
  sort?: { field: string; direction: SortDirection };
  /** Navigate forward to the next page. */
  goNext: () => void;
  /** Navigate backward to the previous page. */
  goPrev: () => void;
  /** Reset navigation to the first page (clearing cursors). */
  firstPage: () => void;
  /** Change page size (automatically resets cursors to page 1). */
  setPageSize: (size: number) => void;
  /** Update search term (automatically resets cursors to page 1). */
  setSearch: (search: string) => void;
  /** Update sort order (automatically resets cursors to page 1). */
  setSort: (field: string, direction?: SortDirection) => void;
  /** True only when the backend confirmed the cursor is invalid or expired (HC0078). */
  isStaleCursor: boolean;
  /**
   * Ready-to-use CursorServerPaging object that can be passed directly
   * to DataTable via the `cursor` prop.
   */
  pagingProps: CursorServerPaging;
  /**
   * Ready-to-use ServerSort object that can be passed to DataTable via the `serverSort` prop.
   */
  sortProps: ServerSort;
}

const DEFAULT_PAGE_INFO: PageInfo = {
  hasNextPage: false,
  hasPreviousPage: false,
  startCursor: null,
  endCursor: null,
};

export function useCursorPagination({
  pageInfo = DEFAULT_PAGE_INFO,
  totalCount,
  defaultPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  stateKey,
  urlState = true,
  initialSort,
  loading = false,
  error,
}: UseCursorPaginationOptions = {}): UseCursorPaginationResult {
  const { params, setParams, hasRouter } = useQueryParams();
  const shouldPersist = urlState && hasRouter;

  const p = useCallback((key: string) => paramName(stateKey, key), [stateKey]);

  // Local Cursor Stack mode for dialogs / components without URL sync
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [localSize, setLocalSize] = useState(defaultPageSize);
  const [localSearch, setLocalSearch] = useState('');
  const [localSort, setLocalSort] = useState<{ field: string; direction: SortDirection } | undefined>(
    initialSort ? { field: initialSort.field, direction: initialSort.direction ?? 'asc' } : undefined,
  );

  // Active cursors & page size
  const rawAfter = shouldPersist ? params.get(p(PAGINATION_PARAM_NAMES.AFTER)) ?? '' : '';
  const rawBefore = shouldPersist ? (rawAfter ? '' : params.get(p(PAGINATION_PARAM_NAMES.BEFORE)) ?? '') : '';
  const stackCursor = !shouldPersist ? cursorStack[cursorStack.length - 1] ?? undefined : undefined;

  const after = shouldPersist ? (rawAfter || undefined) : stackCursor;
  const before = shouldPersist ? (rawBefore || undefined) : undefined;

  const pageSize = shouldPersist
    ? parsePageSize(params.get(p(PAGINATION_PARAM_NAMES.SIZE)), pageSizeOptions, defaultPageSize)
    : localSize;
  const search = shouldPersist ? params.get(p(PAGINATION_PARAM_NAMES.SEARCH)) ?? '' : localSearch;
  const urlSort = shouldPersist ? decodeSort(params.get(p(PAGINATION_PARAM_NAMES.SORT))) : localSort;
  const sort = urlSort ?? (initialSort ? { field: initialSort.field, direction: initialSort.direction ?? 'asc' } : undefined);

  const totalPages = totalCount !== undefined ? Math.max(1, Math.ceil(totalCount / pageSize)) : undefined;

  // Derive current page number
  let currentPage = 1;
  if (!shouldPersist) {
    currentPage = cursorStack.length;
  } else {
    const requestedPage = parsePage(params.get(p(PAGINATION_PARAM_NAMES.PAGE)));
    if (!pageInfo.hasPreviousPage) {
      currentPage = 1;
    } else if (totalPages !== undefined && !pageInfo.hasNextPage) {
      currentPage = totalPages;
    } else {
      currentPage = totalPages !== undefined
        ? Math.min(Math.max(requestedPage, 2), Math.max(2, totalPages - 1))
        : Math.max(1, requestedPage);
    }
  }

  // Stale cursor detection: ONLY when backend explicitly confirms invalid cursor (HC0078).
  // An empty result without an error is a valid empty page — do NOT treat it as stale.
  const hasCursor = Boolean(after || before);
  const isStaleCursor = hasCursor && isInvalidCursorError(error);

  // Forward Navigation
  const goNext = useCallback(() => {
    if (!pageInfo.hasNextPage) return;
    const nextCursor = pageInfo.endCursor;
    if (!nextCursor) return;

    if (shouldPersist) {
      setParams({
        [p(PAGINATION_PARAM_NAMES.AFTER)]: nextCursor,
        [p(PAGINATION_PARAM_NAMES.BEFORE)]: null,
        [p(PAGINATION_PARAM_NAMES.PAGE)]: currentPage + 1,
      });
    } else {
      setCursorStack((prev) => [...prev, nextCursor]);
    }
  }, [pageInfo, shouldPersist, setParams, p, currentPage]);

  // Backward Navigation
  const goPrev = useCallback(() => {
    if (shouldPersist) {
      if (!pageInfo.hasPreviousPage) return;
      if (currentPage <= 2) {
        // Reset to first page
        setParams({
          [p(PAGINATION_PARAM_NAMES.AFTER)]: null,
          [p(PAGINATION_PARAM_NAMES.BEFORE)]: null,
          [p(PAGINATION_PARAM_NAMES.PAGE)]: null,
        });
      } else {
        const prevCursor = pageInfo.startCursor;
        if (!prevCursor) return;
        setParams({
          [p(PAGINATION_PARAM_NAMES.BEFORE)]: prevCursor,
          [p(PAGINATION_PARAM_NAMES.AFTER)]: null,
          [p(PAGINATION_PARAM_NAMES.PAGE)]: currentPage - 1,
        });
      }
    } else {
      if (cursorStack.length <= 1) return;
      setCursorStack((prev) => prev.slice(0, -1));
    }
  }, [pageInfo, shouldPersist, setParams, p, currentPage, cursorStack.length]);

  // Return to first page
  const firstPage = useCallback(() => {
    if (shouldPersist) {
      setParams({
        [p(PAGINATION_PARAM_NAMES.AFTER)]: null,
        [p(PAGINATION_PARAM_NAMES.BEFORE)]: null,
        [p(PAGINATION_PARAM_NAMES.PAGE)]: null,
      });
    } else {
      setCursorStack([null]);
    }
  }, [shouldPersist, setParams, p]);

  // Page Size Change (resets cursors)
  const setPageSize = useCallback(
    (nextSize: number) => {
      if (shouldPersist) {
        setParams({
          [p(PAGINATION_PARAM_NAMES.SIZE)]: nextSize === defaultPageSize ? null : nextSize,
          [p(PAGINATION_PARAM_NAMES.AFTER)]: null,
          [p(PAGINATION_PARAM_NAMES.BEFORE)]: null,
          [p(PAGINATION_PARAM_NAMES.PAGE)]: null,
        });
      } else {
        setLocalSize(nextSize);
        setCursorStack([null]);
      }
    },
    [shouldPersist, setParams, p, defaultPageSize],
  );

  // Search Change (resets cursors)
  const setSearch = useCallback(
    (nextSearch: string) => {
      const trimmed = nextSearch.trim();
      if (shouldPersist) {
        setParams({
          [p(PAGINATION_PARAM_NAMES.SEARCH)]: trimmed || null,
          [p(PAGINATION_PARAM_NAMES.AFTER)]: null,
          [p(PAGINATION_PARAM_NAMES.BEFORE)]: null,
          [p(PAGINATION_PARAM_NAMES.PAGE)]: null,
        });
      } else {
        setLocalSearch(trimmed);
        setCursorStack([null]);
      }
    },
    [shouldPersist, setParams, p],
  );

  // Sort Change (resets cursors)
  const setSort = useCallback(
    (field: string, direction?: SortDirection) => {
      const encoded = encodeSort(field, direction);
      if (shouldPersist) {
        setParams({
          [p(PAGINATION_PARAM_NAMES.SORT)]: encoded,
          [p(PAGINATION_PARAM_NAMES.AFTER)]: null,
          [p(PAGINATION_PARAM_NAMES.BEFORE)]: null,
          [p(PAGINATION_PARAM_NAMES.PAGE)]: null,
        });
      } else {
        setLocalSort(encoded ? { field, direction: direction ?? 'asc' } : undefined);
        setCursorStack([null]);
      }
    },
    [shouldPersist, setParams, p],
  );

  const pagingProps: CursorServerPaging = {
    pageInfo,
    currentPage,
    size: pageSize,
    totalCount,
    totalPages,
    onNext: goNext,
    onPrev: goPrev,
    onFirstPage: firstPage,
    onPageSizeChange: setPageSize,
    pageSizeOptions,
    search,
    onSearchChange: setSearch,
    loading,
    error,
    isStaleCursor,
  };

  const sortProps: ServerSort = {
    field: sort?.field,
    direction: sort?.direction,
    onChange: setSort,
  };

  return {
    after,
    before,
    currentPage,
    pageSize,
    totalPages,
    search,
    sort,
    goNext,
    goPrev,
    firstPage,
    setPageSize,
    setSearch,
    setSort,
    isStaleCursor,
    pagingProps,
    sortProps,
  };
}

