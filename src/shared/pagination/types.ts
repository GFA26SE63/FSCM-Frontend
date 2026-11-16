/**
 * FSCM Web Portal – Shared Pagination Architecture Types
 * Phase 0: Foundation
 *
 * Defines the standard interfaces for:
 * 1. Client-side Pagination
 * 2. REST Server-side Pagination
 * 3. GraphQL Cursor Pagination
 * 4. ServerSort Capability
 */

export type PaginationMode = 'client' | 'rest' | 'cursor';

export const DEFAULT_PAGE_SIZES = [10, 20, 50] as const;
export type PageSizeOption = (typeof DEFAULT_PAGE_SIZES)[number];

export type SortDirection = 'asc' | 'desc';

/**
 * ServerSort capability that can be combined independently with either
 * REST Server-side Pagination or GraphQL Cursor Pagination.
 */
export interface ServerSort {
  /** The current active sort field (e.g. 'createdAt', 'code'). */
  field?: string;
  /** The current sort direction ('asc' | 'desc'), or undefined when unsorted. */
  direction?: SortDirection;
  /** Callback triggered when user clicks a column header to change sort. */
  onChange: (field: string, direction?: SortDirection) => void;
  /** Optional whitelist of sortable fields. If provided, only columns with keys in this list can be sorted. */
  sortableFields?: readonly string[];
}

/**
 * Standard GraphQL Relay-style PageInfo interface.
 * Cursors must always be treated as opaque strings.
 */
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
}

/**
 * Standard REST Server-side Pagination interface.
 * Represents offset/page-based pagination driven by the server.
 */
export interface RestServerPaging {
  /** Current 1-based page number. */
  page: number;
  /** Current page size (items per page). */
  size: number;
  /** Total count of records across all pages. */
  total: number;
  /** Total number of pages (derivable as ceil(total / size)). */
  totalPages?: number;
  /** Callback when page number changes. */
  onPageChange: (page: number) => void;
  /** Optional callback when page size changes. */
  onPageSizeChange?: (size: number) => void;
  /** Selectable page size options, default [10, 20, 50]. */
  pageSizeOptions?: readonly number[];
  /** Optional server search term. */
  search?: string;
  /** Callback when server search changes. */
  onSearchChange?: (search: string) => void;
  /** Optional loading indicator during page transitions. */
  loading?: boolean;
  /** Optional error state. */
  error?: unknown;
}

/**
 * Standard GraphQL Cursor Pagination interface.
 * Driven by opaque cursors (after/before) and pageInfo.
 */
export interface CursorServerPaging {
  /** GraphQL Relay pageInfo metadata. */
  pageInfo: PageInfo;
  /** Current 1-based page number (derived from URL or cursor stack). */
  currentPage: number;
  /** Current page size. */
  size: number;
  /** Total count across all records, if provided by the GraphQL query. */
  totalCount?: number;
  /** Total number of pages, derivable only when totalCount is available. */
  totalPages?: number;
  /** Callback to navigate forward (after = pageInfo.endCursor). */
  onNext: () => void;
  /** Callback to navigate backward (before = pageInfo.startCursor or pop stack). */
  onPrev: () => void;
  /** Callback to reset to the first page (clear cursors). */
  onFirstPage?: () => void;
  /** Optional callback when page size changes (must reset cursors to first page). */
  onPageSizeChange?: (size: number) => void;
  /** Selectable page size options, default [10, 20, 50]. */
  pageSizeOptions?: readonly number[];
  /** Optional server search term. */
  search?: string;
  /** Callback when server search changes. */
  onSearchChange?: (search: string) => void;
  /** Loading indicator during cursor transitions. */
  loading?: boolean;
  /** Error state if query failed. */
  error?: unknown;
  /**
   * Flag indicating the cursor resulted in zero records (data deleted or stale cursor).
   * Used to display a friendly prompt to return to the first page.
   */
  isStaleCursor?: boolean;
}

/**
 * Backward compatibility alias: `ServerPaging` is an alias/extension of `RestServerPaging`.
 */
export type ServerPaging = RestServerPaging;

