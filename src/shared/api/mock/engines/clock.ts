import { addDays } from '../../../lib/dates';

/** The mock runs on a frozen demo clock so every number matches the prototype (SPEC §6 example: today 27/09/2026). */
export const MOCK_TODAY = '2026-09-27';
export const MOCK_NOW = '2026-09-27T10:45';
/** Expected dispatch date used by the allocation ETA (morning run after approval). */
export const DISPATCH_DATE = addDays(MOCK_TODAY, 1);

let tick = 0;
const pad = (n: number) => String(n).padStart(2, '0');
/** Monotonic "now" for new timeline entries / documents (advances 3 minutes per call). */
export function stamp(): string {
  tick += 1;
  const total = 10 * 60 + 45 + tick * 3;
  return `${MOCK_TODAY}T${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}
export const yymmdd = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
