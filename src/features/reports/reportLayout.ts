/**
 * Summary tiles fill the page width: one row when there are up to `perRow` tiles, otherwise two
 * rows split as evenly as possible (the first row takes the extra tile).
 */
export function summaryColumns(count: number, perRow = 6) {
  if (count <= 0) return 1;
  return count <= perRow ? count : Math.ceil(count / 2);
}

/** Page title per report kind, matching the sidebar entries. */
export const REPORT_TITLES = {
  redemptions: 'Báo cáo đổi quà',
  loyalty: 'Báo cáo loyalty',
  promotions: 'Báo cáo khuyến mãi',
} as const;
