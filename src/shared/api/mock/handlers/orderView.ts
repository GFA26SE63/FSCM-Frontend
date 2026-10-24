import { db } from '../fixtures';
import type { DbOrder } from '../fixtures/types';
import { daysBetween } from '../../../lib/dates';
import { DISPATCH_DATE, MOCK_TODAY } from '../engines/clock';
import { priceLines } from '../engines/pricing';
import { traceAllocation, type TraceResult } from '../engines/allocation';
import { quoteTransit } from '../engines/transit';
import { mockGuid, product, retailer, warehouseName, areaName } from './common';

export const mlorOf = (retailerCode: string, sku: string) => db.retailerMlor[retailerCode]?.[sku] ?? product(sku).defaultMlor;

export function traceOf(o: DbOrder): TraceResult {
  return traceAllocation({
    lines: o.lines, heldBefore: o.heldBefore, batches: db.batches, warehouses: db.warehouses, products: db.products, distances: db.retailerDist[o.retailerCode] ?? {},
    mlorOf: (sku) => mlorOf(o.retailerCode, sku), bands: db.transit.bands, settings: db.settings, today: MOCK_TODAY, dispatchDate: DISPATCH_DATE,
  });
}

export const pricingOf = (o: DbOrder) => priceLines(o.lines, o.retailerCode, db.promotions.filter((p) => o.promoIds.includes(p.code)), db.products);

export function deliveryCostOf(o: DbOrder, trace: TraceResult) {
  const codes = [...new Set(trace.lines.flatMap((l) => l.allocations.map((a) => a.warehouseCode)))];
  const parts = codes.map((w) => {
    const km = db.retailerDist[o.retailerCode]?.[w] ?? 0;
    const t = quoteTransit(km, 'retailer', db.transit.bands, db.settings.dmaxRetailerKm);
    return { warehouseCode: w, warehouseName: warehouseName(w), km, cost: t?.cost ?? 0 };
  });
  return { parts, total: parts.reduce((a, x) => a + x.cost, 0) };
}

export function receivableOf(o: DbOrder) {
  if (o.paymentMethod !== 'Credit' || !o.credit?.deliveredAt) return null;
  const c = o.credit;
  const total = pricingOf(o).final;
  const status = c.paid ? 'Paid' : c.dueDate && daysBetween(MOCK_TODAY, c.dueDate) < 0 ? 'Overdue' : 'Unpaid';
  return {
    orderCode: o.code, retailerCode: o.retailerCode, retailerName: retailer(o.retailerCode).name, salesName: o.salesName, termDays: c.termDays,
    deliveredAt: c.deliveredAt, dueDate: c.dueDate, total, outstanding: c.paid ? 0 : total, status, paidAt: c.paidAt, collectedBy: c.collectedBy, method: c.method,
  };
}

export const itemsSummary = (o: DbOrder) => o.lines.map((l) => `${product(l.sku).name} ×${l.qty}`).join(' · ');

export function orderSummary(o: DbOrder) {
  return {
    code: o.code, retailerCode: o.retailerCode, retailerName: retailer(o.retailerCode).name, itemsSummary: itemsSummary(o), salesName: o.salesName, createdAt: o.createdAt,
    channel: o.channel, total: pricingOf(o).final, status: o.status, paymentMethod: o.paymentMethod, termDays: o.termDays,
  };
}

export interface PickingListRow {
  code: string; orderCode: string; warehouseCode: string; warehouseName: string; keeperName: string | null; status: 'NotPicked' | 'Picking' | 'Shipped';
  lines: { sku: string; productName: string; batchCode: string; expiry: string; qty: number }[]; lineCount: number; totalQty: number;
}

/** One picking list per warehouse of an approved order: code = order code + A/B/C (SPEC §3). */
export function pickingLists(): PickingListRow[] {
  const out: PickingListRow[] = [];
  db.orders
    .filter((o) => !o.archived && ['Approved', 'Picking', 'Shipped', 'Delivering', 'Delivered', 'Completed'].includes(o.status))
    .forEach((o) => {
      const trace = traceOf(o);
      const byWh = new Map<string, PickingListRow['lines']>();
      trace.lines.forEach((l) => l.allocations.forEach((a) => byWh.set(a.warehouseCode, [...(byWh.get(a.warehouseCode) ?? []), { sku: a.sku, productName: l.productName, batchCode: a.batchCode, expiry: a.expiry, qty: a.qty }])));
      [...byWh.entries()].forEach(([w, lines], i) => {
        const code = o.code + String.fromCharCode(65 + i);
        const open = o.status === 'Approved' || o.status === 'Picking';
        const wh = db.warehouses.find((x) => x.code === w)!;
        out.push({
          code, orderCode: o.code, warehouseCode: w, warehouseName: wh.name, keeperName: wh.keeperName, status: open ? db.pickStatus[code] ?? 'NotPicked' : 'Shipped',
          lines, lineCount: lines.length, totalQty: lines.reduce((a, x) => a + x.qty, 0),
        });
      });
    });
  return out;
}

export function orderDetail(o: DbOrder) {
  const r = retailer(o.retailerCode);
  const price = pricingOf(o);
  const trace = traceOf(o);
  const dispatched = ['Shipped', 'Delivering', 'Delivered', 'Completed'].includes(o.status);
  const failed = ['Rejected', 'Cancelled'].includes(o.status);
  const allocationState = o.status === 'Cancelled' ? 'Released' : failed ? 'Failed' : !trace.ok ? 'Failed' : dispatched ? 'Dispatched' : o.status === 'Pending' ? 'Held' : 'Reserved';
  const rec = receivableOf(o);
  const points = failed ? 0 : Math.floor(price.final / db.settings.loyaltyPointRateVnd);
  const loyaltyState = failed ? 'None' : o.paymentMethod === 'Credit' ? (rec?.status === 'Paid' ? 'Earned' : 'AwaitingPayment') : ['Delivered', 'Completed'].includes(o.status) ? 'Earned' : 'AwaitingScan';
  const group = db.groups.find((g) => g.members.includes(o.salesName));
  return {
    ...orderSummary(o),
    id: mockGuid(o.code),
    retailerAddress: r.address, groupCode: group?.code ?? r.groupCode, areaName: areaName(r.areaCode),
    syncedAt: o.syncedAt, syncMode: o.syncMode, prepaidChannel: o.prepaidChannel, paymentStatus: o.paidNote,
    receivable: rec ? { status: rec.status, dueDate: rec.dueDate, outstanding: rec.outstanding, deliveredAt: rec.deliveredAt } : null,
    reviewer: o.reviewer, rejectReason: o.status === 'Rejected' ? o.reason : null, cancelReason: o.status === 'Cancelled' ? o.reason : null,
    promoChange: o.promoChanged ? { localDiscount: o.localDiscount, officialDiscount: price.discount, reason: 'KM-003 đã bị Admin tạm dừng lúc 09:30, sau lần app tải dữ liệu gần nhất.' } : null,
    lines: price.lines.map((l) => {
      // The order froze its MLOR when it was accepted; the run copies it rather than re-resolving.
      const own = db.retailerMlor[o.retailerCode]?.[l.sku];
      const ratio = own ?? product(l.sku).defaultMlor;
      return {
        ...l,
        mlor: {
          sourceScope: own != null ? 'Sku' : 'Default',
          minimumLifeRatio: ratio,
          minimumLifeHours: Math.round(ratio * product(l.sku).shelfLifeDays * 24),
          resolvedAt: o.createdAt,
        },
        finalPricePendingAllocation: ['Pending', 'Approved'].includes(o.status),
      };
    }),
    promotions: price.promotions, totalBeforePromo: price.total, discount: price.discount, finalPrice: price.final,
    allocationState, allocations: trace.ok ? trace.lines.flatMap((l) => l.allocations) : [],
    estimatedDeliveryCost: trace.ok ? deliveryCostOf(o, trace) : null,
    delivery: o.delivery, loyalty: { points, state: loyaltyState },
    pickingLists: pickingLists().filter((p) => p.orderCode === o.code).map((p) => ({ code: p.code, warehouseName: p.warehouseName })),
    timeline: o.timeline, totalQty: o.lines.reduce((a, l) => a + l.qty, 0),
  };
}

const HOURS_PER_DAY = 24;
const arrivalInstant = (isoDate: string) => `${isoDate}T09:00:00+07:00`;

/**
 * Maps this mock's day-based engine onto the real trace shape (hours, one row per filter stage,
 * one row per ranked batch per greedy turn), so the portal renders what the server will send.
 *
 * Two honest gaps, because the mock engine does not record them: it keeps the full ranking only for
 * the first turn, so later turns show their winner alone; and it has no notion of a line released
 * because another line of the same order fell short, so no Released outcome appears here.
 */
export function allocationTraceOf(o: DbOrder) {
  const trace = traceOf(o);
  const approved = !['Pending', 'Rejected', 'Cancelled'].includes(o.status);
  const weights = {
    shelfLife: db.settings.allocation.wE,
    distance: db.settings.allocation.wD,
    coverage: db.settings.allocation.wQ,
    maximumDistanceMeters: db.settings.dmaxRetailerKm * 1000,
  };

  return {
    salesOrderId: mockGuid(o.code),
    orderCode: o.code,
    allocationRunId: mockGuid(`${o.code}-run`),
    runCode: `PB-${DISPATCH_DATE.replace(/-/g, '')}-01`,
    allocationPlanVersionId: mockGuid(`${o.code}-ver`),
    planVersionNumber: 1,
    planVersionStatus: approved ? 'Approved' : 'AwaitingApproval',
    isApproved: approved,
    lines: trace.lines.map((l, index) => {
      const requiredHours = l.mlorDays * HOURS_PER_DAY;
      const ident = (row: { warehouseName: string; batchCode: string }) => ({
        batchId: mockGuid(row.batchCode),
        batchCode: row.batchCode,
        warehouseId: mockGuid(row.warehouseName),
        warehouseCode: row.warehouseName,
      });
      const candidates = [
        ...l.b1.map((row) => ({
          ...ident(row),
          stage: 'Pool' as const,
          passed: row.kept,
          reason: row.kept ? ('Eligible' as const) : ('NoRemainingQuantity' as const),
          estimatedArrivalAt: null,
          remainingShelfLifeHours: null,
          requiredShelfLifeHours: null,
        })),
        ...l.b2a.map((row) => ({
          ...ident(row),
          stage: 'Distance' as const,
          passed: row.kept,
          reason: row.kept ? ('Eligible' as const) : ('OutsideServiceRadius' as const),
          estimatedArrivalAt: null,
          remainingShelfLifeHours: null,
          requiredShelfLifeHours: null,
        })),
        ...l.b2d.map((row) => ({
          ...ident(row),
          stage: 'Delivery' as const,
          passed: row.kept,
          reason: row.kept ? ('Eligible' as const) : ('BelowMlor' as const),
          estimatedArrivalAt: arrivalInstant(row.eta),
          remainingShelfLifeHours: row.remainingDays * HOURS_PER_DAY,
          requiredShelfLifeHours: requiredHours,
        })),
      ];

      const turns = l.b4.filter((row) => row.turn != null);
      const scores = turns.flatMap((turn) =>
        (turn.turn === 1 ? l.b3 : l.b3.filter((row) => row.batchCode === turn.batchCode)).map((row, rank) => ({
          ...ident(row),
          iteration: turn.turn as number,
          rank: turn.turn === 1 ? row.rank : rank + 1,
          remainingDemand: turn.need,
          shelfLifeScore: row.fE,
          distanceScore: row.fD,
          coverageScore: row.fQ,
          weightedScore: row.score,
          selected: row.batchCode === turn.batchCode,
          selectedQuantity: row.batchCode === turn.batchCode ? turn.take : 0,
        })),
      );

      return {
        salesOrderLineId: mockGuid(`${o.code}-${l.sku}`),
        allocationRunLineId: mockGuid(`${o.code}-${l.sku}-run`),
        sku: l.sku,
        lineNumber: index + 1,
        outcome: l.enough ? ('Allocated' as const) : ('Short' as const),
        orderedQuantity: l.qty,
        drawnQuantity: l.allocated,
        shortageQuantity: l.short,
        mlorSource: db.retailerMlor[o.retailerCode]?.[l.sku] != null
          ? ('RetailerProduct' as const)
          : ('ProductDefault' as const),
        effectiveMlorRatio: l.m,
        totalShelfLifeHours: l.shelfLifeDays * HOURS_PER_DAY,
        requiredShelfLifeHours: requiredHours,
        weights,
        note: l.enough ? null : `Dòng ${index + 1} (${l.sku}) thiếu ${l.short} trên ${l.qty}.`,
        candidates,
        scores,
      };
    }),
  };
}
