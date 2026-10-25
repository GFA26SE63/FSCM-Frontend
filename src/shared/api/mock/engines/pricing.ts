import type { DbProduct, DbPromotion } from '../fixtures/types';

export interface PricedLine {
  no: number; sku: string; name: string; unitPrice: number; qty: number;
  promotionCode: string | null; promotionPct: number; discount: number; lineTotal: number;
}
export interface PricedPromotion { no: number; code: string; name: string; detail: string; amount: number }
export interface PricedOrder { lines: PricedLine[]; promotions: PricedPromotion[]; total: number; discount: number; final: number }

/**
 * Promotion calculation, mirroring the server: a line takes at most ONE promotion - the best
 * percentage among those whose SKU (or category) matches, whose retailer scope allows it, and whose
 * minimum quantity this line reaches on its own. Percentages never add up.
 */
export function priceLines(raw: { sku: string; qty: number }[], retailerCode: string, activePromotions: DbPromotion[], products: DbProduct[]): PricedOrder {
  const promos = activePromotions.filter((p) => !p.retailerCodes || p.retailerCodes.includes(retailerCode));
  const applied = new Map<string, PricedPromotion & { parts: string[] }>();
  let total = 0;
  let discount = 0;
  const lines = raw.map((l, i): PricedLine => {
    const p = products.find((x) => x.sku === l.sku);
    const unit = p?.basePrice ?? 0;
    const base = unit * l.qty;
    let best: { code: string; name: string; pct: number } | null = null;
    for (const pr of promos) {
      const covers = pr.skus.includes(l.sku) || (p != null && pr.categoryCodes.includes(p.categoryCode));
      if (!covers || l.qty < pr.minQty) continue;
      if (!best || pr.discountPct > best.pct) best = { code: pr.code, name: pr.name, pct: pr.discountPct };
    }
    const disc = best ? Math.round((base * best.pct) / 100) : 0;
    total += base;
    discount += disc;
    if (best) {
      const cur = applied.get(best.code) ?? { no: 0, code: best.code, name: best.name, detail: '', amount: 0, parts: [] };
      cur.parts.push(`${l.sku} × ${l.qty} (−${best.pct}%)`);
      cur.amount += disc;
      applied.set(best.code, cur);
    }
    return { no: i + 1, sku: l.sku, name: p?.name ?? l.sku, unitPrice: unit, qty: l.qty, promotionCode: best?.code ?? null, promotionPct: best?.pct ?? 0, discount: disc, lineTotal: base - disc };
  });
  const promotions = [...applied.values()].map((a, i) => ({ no: i + 1, code: a.code, name: a.name, detail: a.parts.join(', '), amount: a.amount }));
  return { lines, promotions, total, discount, final: total - discount };
}
