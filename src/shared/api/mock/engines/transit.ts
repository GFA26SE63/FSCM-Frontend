import type { TransitBand } from '../fixtures/types';

export interface TransitQuote {
  days: number;
  cost: number;
  band: string;
  scope: TransitBand['scope'];
}

export const bandLabel = (b: Pick<TransitBand, 'fromKm' | 'toKm'>) => `${b.fromKm === 0 ? '0' : '> ' + b.fromKm} – ${b.toKm} km`;

/**
 * Shared transit rule table (SPEC §7, CR-02). `dmax` is Dmax_retailer (purpose "retailer") or Dmax_kho ("warehouse");
 * beyond it – or when the band does not apply to the purpose – the leg is not served (null).
 */
export function quoteTransit(km: number, purpose: 'retailer' | 'warehouse', bands: TransitBand[], dmax: number): TransitQuote | null {
  if (km > dmax) return null;
  const i = bands.findIndex((b, idx) => km <= b.toKm && (idx === 0 ? km >= b.fromKm : km > b.fromKm));
  if (i < 0) return null;
  const b = bands[i];
  if (purpose === 'retailer' && b.scope === 'WarehouseOnly') return null;
  return { days: b.days, cost: b.cost, band: bandLabel(b), scope: b.scope };
}
