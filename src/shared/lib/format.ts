/** Formatting helpers – vi-VN locale, money in đồng (đ). */
const nf = new Intl.NumberFormat('vi-VN');

export const formatNumber = (n: number | null | undefined, digits = 0): string =>
  n == null || Number.isNaN(n) ? '—' : n.toLocaleString('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** 1250000 → "1.250.000đ" (same as prototype fmt()). */
export const formatMoney = (n: number | null | undefined): string => (n == null ? '—' : nf.format(Math.round(n)) + 'đ');

/** 1250000 → "1,3 tr" for compact cells. */
export const formatMoneyShort = (n: number): string => (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr';

export const formatScore = (n: number | null | undefined): string => (n == null ? '—' : n.toFixed(3));

export const formatKm = (km: number | null | undefined): string => (km == null ? '—' : km.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' km');

export const formatCases = (n: number | null | undefined): string => (n == null ? '—' : formatNumber(n) + ' thùng');

export const formatPercent = (n: number, digits = 0): string => n.toLocaleString('vi-VN', { maximumFractionDigits: digits }) + '%';

/**
 * Hours, with the equivalent in days beside them once there are enough to be hard to read.
 * Shelf life and MLOR are compared in hours, never whole days: arriving next morning differs from
 * arriving that evening, and rounding to days would hide it.
 */
export const formatHours = (h: number | null | undefined): string => {
  if (h == null) return '—';
  const hours = formatNumber(h, 1) + ' giờ';
  return Math.abs(h) < 48 ? hours : `${hours} (~${formatNumber(h / 24, 1)} ngày)`;
};
