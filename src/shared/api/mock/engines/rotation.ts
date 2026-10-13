import { daysBetween } from '../../../lib/dates';
import type { DbBatch, DbProduct, DbSettings, DbWarehouse, TransitBand } from '../fixtures/types';
import { round3 } from './allocation';
import { quoteTransit, type TransitQuote } from './transit';

/**
 * Near-expiry rotation planner – SPEC §6 (CR-01, weighted). Per source batch:
 *  1. sellable window W = L − m·SL − 1 per customer group → C = Σ v·W − older stock ahead, excess E = q − C
 *  2. hard filters on destination warehouses (Dmax_kho, v > 0, receiving capacity N, salvage ≥ trip cost)
 *  3. S = wE·f_E + wD·f_D + wQ·f_Q   4. greedy split rounded down to a multiple of `roundTo`, min `minQty`.
 */
export interface RotationInput {
  batches: DbBatch[];
  warehouses: DbWarehouse[];
  products: DbProduct[];
  velocity: Record<string, Record<string, [number, number, string][]>>;
  whPairs: [string, string, number][];
  bands: TransitBand[];
  settings: DbSettings;
  today: string;
  /** Admin-edited quantities by proposal key `${batch}>${toWarehouse}`. */
  qtyOverrides: Record<string, number>;
}

interface Capacity { rows: { label: string; v: number; m: number; mlor: number; window: number; sell: number }[]; total: number; has: boolean }
interface Candidate {
  w: string; name: string; km: number; t: TransitQuote | null; N: number; ok: boolean; why: string; capTotal: number; qa: number; L?: number;
}

export interface RotationAssign { key: string; to: string; toName: string; km: number; days: number; qty: number; score: number; salvage: number; trip: number; maxQty: number }
export interface RotationPlan {
  batch: DbBatch; product: DbProduct; remainingDays: number; olderAhead: number; sellable: number; excess: number; unitCost: number; capacity: Capacity;
  candidates: Candidate[]; scores: { name: string; tentative: number; fE: number; fD: number; fQ: number; score: number }[];
  turns: { turn: number; name: string; left: number; qty: number; after: number; note: string }[];
  assigns: RotationAssign[]; leftover: number;
}

export const whDistance = (pairs: [string, string, number][], a: string, b: string) => pairs.find((p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a))?.[2] ?? 999;

export function planRotation(input: RotationInput): RotationPlan[] {
  const { settings, today } = input;
  const R = settings.rotation;
  const wh = (code: string) => input.warehouses.find((w) => w.code === code)!;
  const live = input.batches.filter((b) => !b.disposed);

  const capacity = (code: string, sku: string, L: number, sl: number): Capacity => {
    const rows = (input.velocity[code]?.[sku] ?? []).map(([v, m, label]) => {
      const mlor = m * sl;
      const window = Math.max(0, L - mlor - 1);
      return { label, v, m, mlor, window, sell: v * window };
    });
    return { rows, total: rows.reduce((a, x) => a + x.sell, 0), has: rows.length > 0 };
  };
  const ahead = (code: string, b: DbBatch) =>
    live.filter((x) => x.warehouseCode === code && x.sku === b.sku && x.code !== b.code && daysBetween(today, x.expiry) > 0 && x.expiry <= b.expiry).reduce((a, x) => a + x.available, 0);

  const added: Record<string, number> = {};
  const out: RotationPlan[] = [];
  const sources = live
    .filter((b) => wh(b.warehouseCode).type !== 'Central' && input.velocity[b.warehouseCode]?.[b.sku] && b.available > 0 && daysBetween(today, b.expiry) > 0)
    .sort((a, b) => (a.expiry < b.expiry ? -1 : a.expiry > b.expiry ? 1 : a.code < b.code ? -1 : 1));

  for (const b of sources) {
    const p = input.products.find((x) => x.sku === b.sku)!;
    const cost = p.unitCost;
    const L = daysBetween(today, b.expiry);
    const src = capacity(b.warehouseCode, b.sku, L, p.shelfLifeDays);
    const qa = ahead(b.warehouseCode, b);
    const C = Math.max(0, src.total - qa);
    const E = b.available - C;
    if (E <= 0) continue;

    const cands: Candidate[] = input.warehouses
      .filter((w) => w.code !== b.warehouseCode)
      .map((w) => {
        const km = whDistance(input.whPairs, b.warehouseCode, w.code);
        const t = quoteTransit(km, 'warehouse', input.bands, settings.dmaxWarehouseKm);
        const o: Candidate = { w: w.code, name: w.name, km, t, N: 0, ok: false, why: '', capTotal: 0, qa: 0 };
        if (!t) { o.why = `Loại: cách ${km} km > Dmax_kho ${settings.dmaxWarehouseKm} km`; return o; }
        if (w.type === 'Central') { o.why = 'Loại: kho tổng không xuất bán cho retailer (v = 0)'; return o; }
        const ld = L - t.days;
        const cp = capacity(w.code, b.sku, ld, p.shelfLifeDays);
        if (!cp.has) { o.why = `Loại: kho không bán ${b.sku} (v = 0)`; return o; }
        o.qa = ahead(w.code, b) + (added[`${w.code}|${b.sku}`] ?? 0);
        o.capTotal = cp.total;
        o.L = ld;
        o.N = Math.max(0, cp.total - o.qa);
        if (o.N < R.minQty) { o.why = `Loại: receiving capacity N = ${o.N} < ${R.minQty} thùng`; return o; }
        const x0 = Math.floor(Math.min(E, o.N) / R.roundTo) * R.roundTo;
        if (x0 * cost < t.cost) { o.why = `Loại: salvage ${Math.round(x0 * cost).toLocaleString('vi-VN')}đ < trip cost ${t.cost.toLocaleString('vi-VN')}đ`; return o; }
        o.ok = true;
        o.why = 'Đạt';
        return o;
      });

    const score = (o: Candidate, left: number) => {
      const tentative = Math.min(left, o.N);
      const fE = o.capTotal > 0 ? Math.max(0, 1 - (o.qa + tentative) / o.capTotal) : 0;
      const fD = 1 - o.km / settings.dmaxWarehouseKm;
      const fQ = tentative / left;
      return { tentative, fE, fD, fQ, S: R.wE * fE + R.wD * fD + R.wQ * fQ };
    };
    const ok = cands.filter((o) => o.ok);
    const scores = ok.map((o) => ({ o, ...score(o, E) })).sort((a, c) => c.S - a.S || a.o.km - c.o.km);

    let left = E;
    const pool = [...ok];
    const turns: RotationPlan['turns'] = [];
    const assigns: RotationAssign[] = [];
    while (left >= R.minQty && pool.length) {
      pool.sort((a, c) => score(c, left).S - score(a, left).S || a.km - c.km);
      const o = pool.shift()!;
      const s = score(o, left);
      const key = `${b.code}>${o.w}`;
      const override = input.qtyOverrides[key];
      const x = Math.min(override || Math.floor(Math.min(left, o.N) / R.roundTo) * R.roundTo, o.N, left);
      if (x < R.minQty || x * cost < o.t!.cost) {
        turns.push({ turn: turns.length + 1, name: o.name, left, qty: 0, after: left, note: 'Bỏ qua: không đạt lượng tối thiểu / lợi ích' });
        continue;
      }
      turns.push({ turn: turns.length + 1, name: o.name, left, qty: x, after: left - x, note: `S = ${s.S.toFixed(3)}${override ? ' · SL do Admin sửa' : ''}` });
      assigns.push({ key, to: o.w, toName: o.name, km: o.km, days: o.t!.days, qty: x, score: round3(s.S), salvage: x * cost, trip: o.t!.cost, maxQty: Math.min(E, o.N) });
      left -= x;
      added[`${o.w}|${b.sku}`] = (added[`${o.w}|${b.sku}`] ?? 0) + x;
    }
    out.push({
      batch: b, product: p, remainingDays: L, olderAhead: qa, sellable: C, excess: E, unitCost: cost, capacity: src, candidates: cands,
      scores: scores.map((s) => ({ name: s.o.name, tentative: s.tentative, fE: round3(s.fE), fD: round3(s.fD), fQ: round3(s.fQ), score: round3(s.S) })),
      turns, assigns, leftover: left,
    });
  }
  return out;
}
