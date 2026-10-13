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
