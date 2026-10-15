import { addDays, daysBetween } from '../../../lib/dates';
import type { DbBatch, DbProduct, DbSettings, DbWarehouse, TransitBand } from '../fixtures/types';
import { quoteTransit } from './transit';

/** Weighted allocation engine – SPEC §5 (B1–B2 hard filters, B3 score, B4 greedy). Same maths as the backend AllocationEngine. */
export const round3 = (x: number) => Math.round((x + 1e-9) * 1000) / 1000;

export interface AllocationInput {
  lines: { sku: string; qty: number }[];
  /** Cases already held for orders that arrived earlier, by batch code. */
  heldBefore: Record<string, number>;
  batches: DbBatch[];
  warehouses: DbWarehouse[];
  products: DbProduct[];
  /** km from every warehouse to the retailer. */
  distances: Record<string, number>;
  mlorOf: (sku: string) => number;
  bands: TransitBand[];
  settings: DbSettings;
  today: string;
  dispatchDate: string;
}

interface Cand {
  b: DbBatch; whName: string; avail: number; km: number;
  p1: boolean; p2: boolean; p3: boolean; days: number; cost: number; eta: string; remain: number;
  fE: number; fD: number; fQ: number; S: number;
}

export interface TraceLine {
  sku: string; productName: string; qty: number; shelfLifeDays: number; m: number; mlorDays: number;
  b1: { warehouseName: string; batchCode: string; expiry: string; available: number; heldBefore: number; kept: boolean; reason: string }[];
  b2a: { warehouseName: string; batchCode: string; km: number; kept: boolean; reason: string }[];
  b2d: { warehouseName: string; batchCode: string; transitDays: number; eta: string; expiry: string; remainingDays: number; kept: boolean; reason: string }[];
  b3: { rank: number; warehouseName: string; batchCode: string; remainingDays: number; fE: number; fD: number; fQ: number; score: number }[];
  b4: { turn: number | null; warehouseName: string; batchCode: string; available: number; need: number; fQ: number | null; score: number | null; take: number; left: number }[];
  enough: boolean; allocated: number; short: number;
  allocations: { warehouseCode: string; warehouseName: string; sku: string; batchCode: string; expiry: string; km: number; eta: string; remainingDays: number; qty: number; score: number }[];
}
export interface TraceResult { ok: boolean; lines: TraceLine[] }

export function traceAllocation(input: AllocationInput): TraceResult {
  const { settings: st, today } = input;
  const W = st.allocation;
  const whName = (code: string) => input.warehouses.find((w) => w.code === code)?.name ?? code;

  const lines = input.lines.map((l): TraceLine => {
    const p = input.products.find((x) => x.sku === l.sku);
    const sl = p?.shelfLifeDays ?? 30;
    const m = input.mlorOf(l.sku);
    const need = Math.round(m * sl * 10) / 10;

    const cands: Cand[] = input.batches
      .filter((b) => b.sku === l.sku && !b.disposed)
      .map((b) => ({
        b, whName: whName(b.warehouseCode), avail: Math.max(0, b.available - (input.heldBefore[b.code] ?? 0)), km: input.distances[b.warehouseCode] ?? 999,
        p1: false, p2: false, p3: false, days: 0, cost: 0, eta: '', remain: 0, fE: 0, fD: 0, fQ: 0, S: 0,
      }));

    // B1 – not expired, available > 0
    const b1 = cands.map((c) => {
      const expired = daysBetween(today, c.b.expiry) <= 0;
      c.p1 = !expired && c.avail > 0;
      const held = input.heldBefore[c.b.code] ?? 0;
      return { warehouseName: c.whName, batchCode: c.b.code, expiry: c.b.expiry, available: c.avail, heldBefore: held, kept: c.p1, reason: expired ? 'Loại: đã hết hạn' : c.avail <= 0 ? 'Loại: không còn khả dụng' : 'Giữ' };
    });
    const p1 = cands.filter((c) => c.p1);

    // B2a – service radius Dmax_retailer through the shared transit table
    const b2a = p1.map((c) => {
      const t = quoteTransit(c.km, 'retailer', input.bands, st.dmaxRetailerKm);
      c.p2 = !!t;
      return { warehouseName: c.whName, batchCode: c.b.code, km: c.km, kept: c.p2, reason: c.p2 ? 'Trong phạm vi' : `Loại: ngoài ${st.dmaxRetailerKm} km` };
    });
    const p2 = p1.filter((c) => c.p2);

    // B2b–d – ETA and MLOR: EXP − ETA >= m × SL
    const b2d = p2.map((c) => {
      const t = quoteTransit(c.km, 'retailer', input.bands, st.dmaxRetailerKm)!;
      c.days = t.days;
      c.cost = t.cost;
      c.eta = addDays(input.dispatchDate, t.days);
      c.remain = daysBetween(c.eta, c.b.expiry);
      c.p3 = c.remain >= need;
      return { warehouseName: c.whName, batchCode: c.b.code, transitDays: c.days, eta: c.eta, expiry: c.b.expiry, remainingDays: c.remain, kept: c.p3, reason: c.p3 ? 'Đạt' : 'Loại: không đạt MLOR' };
    });
    const el = p2.filter((c) => c.p3);

    // B3 – S = wE·f_E + wD·f_D + wQ·f_Q
    el.forEach((c) => {
      c.fE = sl - need > 0 ? 1 - (c.remain - need) / (sl - need) : 0;
      c.fD = 1 - c.km / st.dmaxRetailerKm;
    });
    const scoreAt = (c: Cand, rem: number) => {
      const fQ = rem > 0 ? Math.min(c.avail, rem) / rem : 0;
      return { fQ, S: W.wE * c.fE + W.wD * c.fD + W.wQ * fQ };
    };
    el.forEach((c) => {
      const s = scoreAt(c, l.qty);
      c.fQ = s.fQ;
      c.S = s.S;
    });
    const byScore = (a: Cand, b: Cand) => b.S - a.S || (a.b.code < b.b.code ? -1 : 1);
    const b3 = [...el].sort(byScore).map((c, i) => ({ rank: i + 1, warehouseName: c.whName, batchCode: c.b.code, remainingDays: c.remain, fE: round3(c.fE), fD: round3(c.fD), fQ: round3(c.fQ), score: round3(c.S) }));

    // B4 – greedy: take the best, recompute f_Q for the rest, ties by batch code
    let left = l.qty;
    const pool = [...el];
    let turn = 0;
    const b4: TraceLine['b4'] = [];
    const allocations: TraceLine['allocations'] = [];
    while (left > 0 && pool.length) {
      turn += 1;
      pool.forEach((c) => {
        const s = scoreAt(c, left);
        c.fQ = s.fQ;
        c.S = s.S;
      });
      pool.sort(byScore);
      const c = pool.shift()!;
      const take = Math.min(left, c.avail);
      const before = left;
      left -= take;
      b4.push({ turn, warehouseName: c.whName, batchCode: c.b.code, available: c.avail, need: before, fQ: round3(c.fQ), score: round3(c.S), take, left });
      allocations.push({ warehouseCode: c.b.warehouseCode, warehouseName: c.whName, sku: l.sku, batchCode: c.b.code, expiry: c.b.expiry, km: c.km, eta: c.eta, remainingDays: c.remain, qty: take, score: round3(c.S) });
    }
    pool.forEach((c) => b4.push({ turn: null, warehouseName: c.whName, batchCode: c.b.code, available: c.avail, need: 0, fQ: null, score: null, take: 0, left: 0 }));
    return { sku: l.sku, productName: p?.name ?? l.sku, qty: l.qty, shelfLifeDays: sl, m, mlorDays: need, b1, b2a, b2d, b3, b4, enough: left <= 0, allocated: l.qty - left, short: left, allocations };
  });
  return { ok: lines.every((x) => x.enough), lines };
}
