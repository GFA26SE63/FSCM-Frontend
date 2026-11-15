/**
 * Calendar dates retain their day. Instants carrying Z/an offset display in Vietnam.
 * Offset-free form values represent Vietnam wall-clock time, not the device timezone.
 */
const pad = (n: number) => String(n).padStart(2, '0');

export const parseIso = (iso: string): Date => {
  const [d, t] = iso.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = (t ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, day, hh || 0, mm || 0);
};

export const toIsoDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toIsoDateTime = (d: Date): string => toVietnamDateTimeInput(d).slice(0, 16);

const VN_ZONE = 'Asia/Ho_Chi_Minh';
const calendarDate = /^\d{4}-\d{2}-\d{2}$/;
const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const instant = (value: string): Date => new Date(
  calendarDate.test(value) ? `${value}T00:00:00+07:00` : hasOffset.test(value) ? value : `${value}+07:00`,
);

/** datetime-local value in Vietnam, preserving seconds/milliseconds for precise forms. */
export const toVietnamDateTimeInput = (value: Date | string = new Date()): string => {
  const date = typeof value === 'string' ? instant(value) : value;
  return new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 23);
};

/** Convert a Vietnam datetime-local input to the UTC instant expected by DateTimeOffset APIs. */
export const vietnamDateTimeToIso = (value: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(value)) {
    throw new Error('Nhập ngày và giờ hợp lệ.');
  }
  const date = instant(value);
  if (!Number.isFinite(date.getTime()) || toVietnamDateTimeInput(date).slice(0, value.length) !== value) {
    throw new Error('Nhập ngày và giờ hợp lệ.');
  }
  return date.toISOString();
};
/** Calendar input value for a real instant, always in the business time zone. */
export const vietnamDate = (value: Date | string = new Date()): string => {
  if (value === '') return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: VN_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(typeof value === 'string' ? instant(value) : value);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export const minimumVersionDate = (currentFrom?: string, now = new Date()): string => {
  const tomorrow = addDays(vietnamDate(now), 1);
  const afterCurrent = currentFrom ? addDays(vietnamDate(currentFrom), 1) : tomorrow;
  return tomorrow > afterCurrent ? tomorrow : afterCurrent;
};
const vnDate = new Intl.DateTimeFormat('vi-VN', { timeZone: VN_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
const vnDateTime = new Intl.DateTimeFormat('vi-VN', { timeZone: VN_ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Formats a real instant (ISO carrying Z or an offset, as DateTimeOffset fields from the backend do)
 * in Vietnam time. Calendar arithmetic uses parseIso separately and does not shift DateOnly values.
 */
export const formatInstantDate = (iso?: string | null): string => (iso && !iso.startsWith('0001') ? vnDate.format(instant(iso)) : '—');
export const formatInstantDateTime = (iso?: string | null): string => (iso && !iso.startsWith('0001') ? vnDateTime.format(instant(iso)) : '—');

export const formatDate = (iso?: string | null): string => {
  if (!iso || iso.startsWith('0001')) return '—';
  if (!calendarDate.test(iso)) return formatInstantDate(iso);
  const d = parseIso(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
export const formatDayMonth = (iso?: string | null): string => {
  if (!iso) return '—';
  return formatDate(iso).slice(0, 5);
};
export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  if (iso.startsWith('0001')) return '—';
  const parts = vnDateTime.formatToParts(instant(iso));
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
};
export const formatShortDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const full = formatDateTime(iso);
  return full === '—' ? full : `${full.slice(0, 5)} ${full.slice(11)}`;
};

export const addDays = (iso: string, days: number): string => {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
};

/** Whole days b − a (DateOnly semantics). */
export const daysBetween = (a: string, b: string): number => Math.round((parseIso(b.slice(0, 10)).getTime() - parseIso(a.slice(0, 10)).getTime()) / 86_400_000);
