export type DateSortOrder = 'newest' | 'oldest';

export const DATE_SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
];

export function sortByDate<T>(rows: readonly T[], value: (row: T) => string | null | undefined, order: DateSortOrder): T[] {
  return [...rows].sort((a, b) => {
    const left = Date.parse(value(a) ?? '');
    const right = Date.parse(value(b) ?? '');
    if (Number.isNaN(left)) return Number.isNaN(right) ? 0 : 1;
    if (Number.isNaN(right)) return -1;
    return order === 'newest' ? right - left : left - right;
  });
}
