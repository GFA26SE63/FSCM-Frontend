/**
 * FSCM Web Portal – Pagination URL Synchronization Utilities
 * Phase 0: Foundation
 *
 * Provides standardized URL parameter names, parsers, and reset strategies
 * to ensure URL query state is strictly synchronized across:
 * - Refresh, Back, Forward, Direct URL navigation
 * - Filter changes, Sort changes, Page size changes
 * - Detail page -> Back to list
 */

import { DEFAULT_PAGE_SIZES, type SortDirection } from './types';

export const PAGINATION_PARAM_NAMES = {
  PAGE: 'page',
  SIZE: 'size',
  AFTER: 'after',
  BEFORE: 'before',
  SEARCH: 'q',
  SORT: 'sort',
} as const;

/**
 * Standard list of URL parameters to clear whenever a filter, search term,
 * sort order, or page size changes. This prevents corrupt/stale cursor states
 * and ensures the user always lands on page 1 of the new slice.
 */
export const PAGINATION_RESETS = [
  PAGINATION_PARAM_NAMES.PAGE,
  PAGINATION_PARAM_NAMES.AFTER,
  PAGINATION_PARAM_NAMES.BEFORE,
] as const;

/**
 * Parses a page size parameter from URL query string.
 * Falls back to the default size if invalid or not in the allowed list.
 */
export function parsePageSize(
  raw: string | null | undefined,
  allowed: readonly number[] = DEFAULT_PAGE_SIZES,
  fallback = 10,
): number {
  if (!raw) return fallback;
  const num = Number(raw);
  if (Number.isInteger(num) && allowed.includes(num)) {
    return num;
  }
  return fallback;
}

/**
 * Encodes a sort field and direction into a canonical URL string (e.g. "createdAt:desc").
 * Returns null if field is not specified.
 */
export function encodeSort(field?: string, direction: SortDirection = 'asc'): string | null {
  if (!field) return null;
  return `${field}:${direction}`;
}

/**
 * Decodes a canonical URL sort string (e.g. "createdAt:desc" or "code:asc")
 * into its field and direction components.
 */
export function decodeSort(raw: string | null | undefined): { field: string; direction: SortDirection } | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const parts = raw.split(':');
  const field = parts[0]?.trim();
  if (!field) return undefined;
  const dir = parts[1]?.toLowerCase();
  const direction: SortDirection = dir === 'desc' ? 'desc' : 'asc';
  return { field, direction };
}

