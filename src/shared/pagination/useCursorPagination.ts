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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
   * Pages reachable by direct navigation (page 1 always, cursor-registered visited pages,
   * and the immediately adjacent prev/next pages).
   */
  availablePages: number[];
  /** Navigate to any valid page number. Triggers sequential cursor resolution for unvisited pages. */
  goToPage: (page: number) => void;
  /** True while sequential cursor resolution is in progress. */
  isResolving: boolean;
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

  // Cursor registry (URL mode): page number N → afterCursor string to reach page N.
  // Page 1 is always reachable without a cursor; registry entries cover pages 2+.
  // Reset whenever filters, sort, page size, or external context change.
  const [cursorRegistry, setCursorRegistry] = useState<Map<number, string>>(() => new Map());

  // Sequential resolution target: set when user clicks an unvisited page indicator.
  // Stored as a ref so the registry useEffect only fires on pageInfo changes (not on target changes),
  // preventing stale-cursor-chain false triggers.
  const pendingTargetRef = useRef<number | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const setPendingTarget = useCallback((target: number | null) => {
    pendingTargetRef.current = target;
    setIsResolving(target !== null);
  }, []);

  // External query context: all non-pagination URL params (status, warehouse, sales, source filters…).
  // When this changes the cursor registry is invalid — data under the new filter is completely different.
  const queryContext = useMemo(() => {
    if (!shouldPersist) return '';
    const paginationKeys = new Set(
      (Object.values(PAGINATION_PARAM_NAMES) as string[]).map((k) => p(k)),
    );
    const parts: string[] = [];
    for (const [key, value] of params.entries()) {
      if (!paginationKeys.has(key)) parts.push(`${key}=${value}`);
    }
    return parts.sort().join('&');
  }, [params, p, shouldPersist]);

  // Track previous queryContext to detect genuine filter changes (skip the first-render no-op).
  const prevQueryContextRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevQueryContextRef.current === null) {
      prevQueryContextRef.current = queryContext;
      return;
    }
    if (prevQueryContextRef.current === queryContext) return;
    prevQueryContextRef.current = queryContext;
    setCursorRegistry(new Map());
    setPendingTarget(null);
  }, [queryContext, setPendingTarget]);

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

  // Cursor registry population and sequential resolution (URL mode only).
  // Fires only when real GraphQL data arrives (pageInfo.endCursor changes) — pendingTargetRef
  // is a ref so it does NOT appear in deps, preventing stale-effect false triggers.
  // The consistency guard (hasPreviousPage vs currentPage > 1) prevents registering stale
  // pageInfo from a previous page while the new page's query is still in-flight.
  useEffect(() => {
    if (!shouldPersist || !pageInfo.endCursor || !pageInfo.hasNextPage) {
      // Dead end: cancel any in-progress sequential resolution.
      if (pendingTargetRef.current !== null) setPendingTarget(null);
      return;
    }
    if (pageInfo.hasPreviousPage !== (currentPage > 1)) return; // pageInfo not yet consistent

    const nextPageNum = currentPage + 1;
    const cursor = pageInfo.endCursor;

    setCursorRegistry((prev) => {
      if (prev.get(nextPageNum) === cursor) return prev; // already registered — no extra render
      const next = new Map(prev);
      next.set(nextPageNum, cursor);
      return next;
    });

    // Sequential resolution: advance one page at a time toward pendingTarget.
    const target = pendingTargetRef.current;
    if (target !== null && currentPage < target) {
      setParams({
        [p(PAGINATION_PARAM_NAMES.AFTER)]: cursor,
        [p(PAGINATION_PARAM_NAMES.BEFORE)]: null,
        [p(PAGINATION_PARAM_NAMES.PAGE)]: nextPageNum,
      });
    } else if (target !== null) {
      // Reached (or passed) target — resolution complete.
      setPendingTarget(null);
    }
  }, [pageInfo.endCursor, pageInfo.hasNextPage, pageInfo.hasPreviousPage, currentPage, shouldPersist, setParams, p, setPendingTarget]);

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
    setCursorRegistry(new Map());
    setPendingTarget(null);
  }, [shouldPersist, setParams, p, setPendingTarget]);

  // Page Size Change (resets cursors + registry + pending resolution)
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
      setCursorRegistry(new Map());
      setPendingTarget(null);
    },
    [shouldPersist, setParams, p, defaultPageSize, setPendingTarget],
  );

  // Search Change (resets cursors + registry + pending resolution)
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
      setCursorRegistry(new Map());
      setPendingTarget(null);
    },
    [shouldPersist, setParams, p, setPendingTarget],
  );

  // Sort Change (resets cursors + registry + pending resolution)
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
      setCursorRegistry(new Map());
      setPendingTarget(null);
    },
    [shouldPersist, setParams, p, setPendingTarget],
  );

  // Pages reachable by direct navigation.
  // URL mode: page 1 (always), visited pages from registry, adjacent prev/next.
  // Stack mode: all pages 1..cursorStack.length (each stack entry is a reachable page).
  const availablePages = useMemo(() => {
    const pages = new Set<number>();
    pages.add(1);
    pages.add(currentPage);
    if (pageInfo.hasPreviousPage && currentPage > 1) pages.add(currentPage - 1);
    if (pageInfo.hasNextPage) pages.add(currentPage + 1);
    if (shouldPersist) {
      for (const pageNum of cursorRegistry.keys()) pages.add(pageNum);
    } else {
      for (let i = 1; i <= cursorStack.length; i++) pages.add(i);
    }
    const result: number[] = [];
    for (const pg of pages) {
      if (pg >= 1 && (totalPages === undefined || pg <= totalPages)) result.push(pg);
    }
    return result.sort((a, b) => a - b);
  }, [currentPage, pageInfo.hasPreviousPage, pageInfo.hasNextPage, cursorRegistry, totalPages, shouldPersist, cursorStack.length]);

  // Navigate to any valid page number.
  // URL mode: direct navigation for registered pages; sequential cursor resolution for unvisited ones.
  // Stack mode: truncate the cursor stack to navigate backward, or chain forward.
  const goToPage = useCallback(
    (targetPage: number) => {
      if (targetPage === currentPage) return;
      if (targetPage < 1) return;
      if (totalPages !== undefined && targetPage > totalPages) return;

      if (targetPage === 1) { firstPage(); return; }

      if (shouldPersist) {
        const cursor = cursorRegistry.get(targetPage);
        if (cursor) {
          // Direct navigation — registry has the afterCursor for this page.
          setPendingTarget(null); // cancel any in-progress resolution
          setParams({
            [p(PAGINATION_PARAM_NAMES.AFTER)]: cursor,
            [p(PAGINATION_PARAM_NAMES.BEFORE)]: null,
            [p(PAGINATION_PARAM_NAMES.PAGE)]: targetPage,
          });
          return;
        }

        // Sequential resolution: target is unvisited. Find the highest registered page below
        // the target as the best jump-off point, then let the registry useEffect chain forward.
        let bestStartPage = 0;
        let bestStartCursor: string | null = null;
        for (const [pageNum, pageCursor] of cursorRegistry.entries()) {
          if (pageNum < targetPage && pageNum > bestStartPage) {
            bestStartPage = pageNum;
            bestStartCursor = pageCursor;
          }
        }

        setPendingTarget(targetPage);

        if (bestStartPage > 0 && bestStartCursor) {
          // Jump to the highest known page before the target, then chain.
          setParams({
            [p(PAGINATION_PARAM_NAMES.AFTER)]: bestStartCursor,
            [p(PAGINATION_PARAM_NAMES.BEFORE)]: null,
            [p(PAGINATION_PARAM_NAMES.PAGE)]: bestStartPage,
          });
        } else if (pageInfo.hasNextPage && pageInfo.endCursor) {
          // No useful registry entry yet. Use the current page's endCursor to advance one step.
          setParams({
            [p(PAGINATION_PARAM_NAMES.AFTER)]: pageInfo.endCursor,
            [p(PAGINATION_PARAM_NAMES.BEFORE)]: null,
            [p(PAGINATION_PARAM_NAMES.PAGE)]: currentPage + 1,
          });
        } else {
          // Cannot navigate forward — cancel.
          setPendingTarget(null);
        }
      } else {
        // Stack mode: navigate to any previously visited page by truncating the stack.
        if (targetPage === currentPage + 1 && pageInfo.hasNextPage) { goNext(); return; }
        if (targetPage <= cursorStack.length) {
          setCursorStack((prev) => prev.slice(0, targetPage));
        }
      }
    },
    [currentPage, totalPages, pageInfo.hasNextPage, pageInfo.endCursor, firstPage, goNext, shouldPersist, cursorRegistry, setParams, p, cursorStack.length, setPendingTarget],
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
    availablePages,
    onPage: goToPage,
    isResolving,
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
    goToPage,
    availablePages,
    isResolving,
    setPageSize,
    setSearch,
    setSort,
    isStaleCursor,
    pagingProps,
    sortProps,
  };
}

