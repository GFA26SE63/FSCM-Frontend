/**
 * FSCM Web Portal – Reusable REST Server-side Pagination Hook
 * Phase 0: Foundation
 *
 * Coordinates URL query state and pagination callbacks for REST server-side endpoints.
 * Automatically handles:
 * - Current page and page size synchronization with URL
 * - Resetting page to 1 when page size, search, sort, or filters change
 * - Graceful fallback to local state if URL sync is disabled
 */

import { useCallback, useState } from 'react';
import { paramName, parsePage, useQueryParams } from '../router/listState';
import { DEFAULT_PAGE_SIZES, type RestServerPaging, type ServerSort, type SortDirection } from './types';
import { decodeSort, encodeSort, PAGINATION_PARAM_NAMES, parsePageSize } from './urlSync';

export interface UseRestPaginationOptions {
  /** Total records count returned by the server. */
  total?: number;
  /** Default page size if not specified in URL. Default: 10. */
  defaultPageSize?: number;
  /** Allowed page size options. Default: [10, 20, 50]. */
  pageSizeOptions?: readonly number[];
  /** Optional namespace for URL query parameters (e.g. for multi-table screens). */
  stateKey?: string;
  /** Whether to sync state to the URL. Default: true. */
  urlState?: boolean;
  /** Optional initial sort configuration. */
  initialSort?: { field: string; direction?: SortDirection };
}

export interface UseRestPaginationResult {
  /** Current 1-based page. */
  page: number;
  /** Current page size. */
  pageSize: number;
  /** Current search query string. */
  search: string;
  /** Current sort settings if applicable. */
  sort?: { field: string; direction: SortDirection };
  /** Handler to change current page. */
  setPage: (page: number) => void;
  /** Handler to change page size (automatically resets page to 1). */
  setPageSize: (size: number) => void;
  /** Handler to update search term (automatically resets page to 1). */
  setSearch: (search: string) => void;
  /** Handler to update sort order (automatically resets page to 1). */
  setSort: (field: string, direction?: SortDirection) => void;
  /**
   * Ready-to-use RestServerPaging object that can be passed directly
   * to DataTable via the `server` prop.
   */
  pagingProps: RestServerPaging;
  /**
   * Ready-to-use ServerSort object that can be passed to DataTable via the `serverSort` prop.
   */
  sortProps: ServerSort;
}

export function useRestPagination({
  total = 0,
  defaultPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  stateKey,
  urlState = true,
  initialSort,
}: UseRestPaginationOptions = {}): UseRestPaginationResult {
  const { params, setParams, hasRouter } = useQueryParams();
  const shouldPersist = urlState && hasRouter;

  const p = useCallback((key: string) => paramName(stateKey, key), [stateKey]);

  // Local state fallbacks when urlState = false
  const [localPage, setLocalPage] = useState(1);
  const [localSize, setLocalSize] = useState(defaultPageSize);
  const [localSearch, setLocalSearch] = useState('');
  const [localSort, setLocalSort] = useState<{ field: string; direction: SortDirection } | undefined>(
    initialSort ? { field: initialSort.field, direction: initialSort.direction ?? 'asc' } : undefined,
  );

  // Read current values (URL or local)
  const page = shouldPersist ? parsePage(params.get(p(PAGINATION_PARAM_NAMES.PAGE))) : localPage;
  const pageSize = shouldPersist
    ? parsePageSize(params.get(p(PAGINATION_PARAM_NAMES.SIZE)), pageSizeOptions, defaultPageSize)
    : localSize;
  const search = shouldPersist ? params.get(p(PAGINATION_PARAM_NAMES.SEARCH)) ?? '' : localSearch;
  const urlSort = shouldPersist ? decodeSort(params.get(p(PAGINATION_PARAM_NAMES.SORT))) : localSort;
  const sort = urlSort ?? (initialSort ? { field: initialSort.field, direction: initialSort.direction ?? 'asc' } : undefined);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // State mutators with automatic page reset to 1
  const setPage = useCallback(
    (nextPage: number) => {
      const validPage = Math.max(1, nextPage);
      if (shouldPersist) {
        setParams({ [p(PAGINATION_PARAM_NAMES.PAGE)]: validPage > 1 ? validPage : null });
      } else {
        setLocalPage(validPage);
      }
    },
    [shouldPersist, setParams, p],
  );

  const setPageSize = useCallback(
    (nextSize: number) => {
      if (shouldPersist) {
        setParams({
          [p(PAGINATION_PARAM_NAMES.SIZE)]: nextSize === defaultPageSize ? null : nextSize,
          [p(PAGINATION_PARAM_NAMES.PAGE)]: null, // Reset to page 1
        });
      } else {
        setLocalSize(nextSize);
        setLocalPage(1);
      }
    },
    [shouldPersist, setParams, p, defaultPageSize],
  );

  const setSearch = useCallback(
    (nextSearch: string) => {
      const trimmed = nextSearch.trim();
      if (shouldPersist) {
        setParams({
          [p(PAGINATION_PARAM_NAMES.SEARCH)]: trimmed || null,
          [p(PAGINATION_PARAM_NAMES.PAGE)]: null, // Reset to page 1
        });
      } else {
        setLocalSearch(trimmed);
        setLocalPage(1);
      }
    },
    [shouldPersist, setParams, p],
  );

  const setSort = useCallback(
    (field: string, direction?: SortDirection) => {
      const encoded = encodeSort(field, direction);
      if (shouldPersist) {
        setParams({
          [p(PAGINATION_PARAM_NAMES.SORT)]: encoded,
          [p(PAGINATION_PARAM_NAMES.PAGE)]: null, // Reset to page 1
        });
      } else {
        setLocalSort(encoded ? { field, direction: direction ?? 'asc' } : undefined);
        setLocalPage(1);
      }
    },
    [shouldPersist, setParams, p],
  );

  const pagingProps: RestServerPaging = {
    page,
    size: pageSize,
    total,
    totalPages,
    onPageChange: setPage,
    onPageSizeChange: setPageSize,
    pageSizeOptions,
    search,
    onSearchChange: setSearch,
  };

  const sortProps: ServerSort = {
    field: sort?.field,
    direction: sort?.direction,
    onChange: setSort,
  };

  return {
    page,
    pageSize,
    search,
    sort,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    pagingProps,
    sortProps,
  };
}

