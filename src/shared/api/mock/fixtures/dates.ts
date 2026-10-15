import type { Iso } from './types';

/** "27/09" → "2026-09-27"; "27/09/2026" → "2026-09-27". */
export const D = (s: string): Iso => {
  const [dd, mm, yy] = s.split('/');
  return `${yy ?? '2026'}-${mm}-${dd}`;
};
/** "27/09 10:12" → "2026-09-27T10:12". */
export const DT = (s: string): Iso => {
  const [d, t] = s.split(' ');
  return `${D(d)}T${t ?? '00:00'}`;
};
/** "20102026" → "2026-10-20". */
export const ddMMyyyy = (s: string): Iso => `${s.slice(4)}-${s.slice(2, 4)}-${s.slice(0, 2)}`;
