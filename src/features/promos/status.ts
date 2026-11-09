import type { PromoSummary } from './types';

/**
 * The server stores whether a promotion is switched on and when it runs; "Ended" is the two read
 * together. Keeping it derived means a promotion cannot be shown as running past its end date
 * merely because nobody switched it off.
 */
export const promoStatus = (p: Pick<PromoSummary, 'isActive' | 'startAt' | 'endAt'>): 'Running' | 'Scheduled' | 'Paused' | 'Ended' => {
  if (new Date(p.endAt).getTime() < Date.now()) return 'Ended';
  if (!p.isActive) return 'Paused';
  return new Date(p.startAt).getTime() > Date.now() ? 'Scheduled' : 'Running';
};
