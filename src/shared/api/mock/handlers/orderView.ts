import { db } from '../fixtures';
import type { DbOrder } from '../fixtures/types';
import { daysBetween } from '../../../lib/dates';
import { DISPATCH_DATE, MOCK_TODAY } from '../engines/clock';
import { priceLines } from '../engines/pricing';
import { traceAllocation, type TraceResult } from '../engines/allocation';
import { quoteTransit } from '../engines/transit';
import { product, retailer, warehouseName, areaName } from './common';

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
          sourceScope: own != null ? 'RetailerProduct' : 'ProductDefault',
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
