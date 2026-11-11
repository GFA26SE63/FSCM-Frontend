/**
 * Date helpers. API dates are ISO strings: "yyyy-MM-dd" (DateOnly) or "yyyy-MM-ddTHH:mm" (local date-time).
 * UI shows dd/MM/yyyy as in the prototype.
 */
const pad = (n: number) => String(n).padStart(2, '0');

export const parseIso = (iso: string): Date => {
  const [d, t] = iso.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = (t ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, day, hh || 0, mm || 0);
};

export const toIsoDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toIsoDateTime = (d: Date): string => `${toIsoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const VN_ZONE = 'Asia/Ho_Chi_Minh';
/** Calendar input value for a real instant, always in the business time zone. */
export const vietnamDate = (value: Date | string = new Date()): string => {
  if (value === '') return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: VN_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
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
 * in Vietnam time. parseIso deliberately drops the offset, so it would read 2026-10-24T17:00:00Z as
 * 24/10 rather than 25/10 and show the wrong effective date.
 */
export const formatInstantDate = (iso?: string | null): string => (iso ? vnDate.format(new Date(iso)) : '—');
export const formatInstantDateTime = (iso?: string | null): string => (iso ? vnDateTime.format(new Date(iso)) : '—');

export const formatDate = (iso?: string | null): string => {
  if (!iso || iso.startsWith('0001')) return '—';
  const d = parseIso(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
export const formatDayMonth = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = parseIso(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};
export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = parseIso(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const formatShortDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = parseIso(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const addDays = (iso: string, days: number): string => {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
};

/** Whole days b − a (DateOnly semantics). */
export const daysBetween = (a: string, b: string): number => Math.round((parseIso(b.slice(0, 10)).getTime() - parseIso(a.slice(0, 10)).getTime()) / 86_400_000);
