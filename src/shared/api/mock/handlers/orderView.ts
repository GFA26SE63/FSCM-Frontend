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
    id: mockGuid(`${o.code}-payment`), orderId: mockGuid(o.code), orderCode: o.code,
    retailerId: mockGuid(o.retailerCode), retailerCode: o.retailerCode,
    retailerName: retailer(o.retailerCode).name, salesUserId: mockGuid(o.salesName),
    creditTermDays: c.termDays, deliveredDate: c.deliveredAt, dueDate: c.dueDate,
    amount: total, adjustedAmount: total, confirmedAmount: c.paid ? total : 0,
    outstandingAmount: c.paid ? 0 : total, status, paidDate: c.paidAt,
    confirmedByUserId: c.collectedBy ? mockGuid(c.collectedBy) : null,
    collectionMethod: c.method === 'Transfer' ? 'BankTransfer' : c.method,
    version: c.paid ? 1 : 0,
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
    receivable: rec ? { status: rec.status, dueDate: rec.dueDate, outstanding: rec.outstandingAmount, deliveredAt: rec.deliveredDate } : null,
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

/**
 * Composes one 12:00 run for a business date out of the mock orders, so the approval screen has
 * something to render. The real run snapshots a shared pool at the cutoff; this reuses each order's
 * own trace, which is close enough to show the shape and never claims to be the engine.
 */
export function allocationRunOf(businessDate: string) {
  const orders = db.orders
    .filter((o) => !o.archived)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.code.localeCompare(b.code));

  const runId = mockGuid(`run-${businessDate}`);
  const lineId = (code: string, sku: string) => mockGuid(`${code}-${sku}-run`);

  return {
    run: {
      id: runId,
      runCode: `PB-${businessDate.replace(/-/g, '')}-01`,
      businessDate,
      cutoffAt: `${businessDate}T12:00:00+07:00`,
      status: 'AwaitingApproval',
      settings: {
        shelfLifeWeight: db.settings.allocation.wE,
        distanceWeight: db.settings.allocation.wD,
        coverageWeight: db.settings.allocation.wQ,
        maxServingDistanceMeters: db.settings.dmaxRetailerKm * 1000,
      },
      transitTableVersion: 1,
      etaScheduleVersion: 1,
      orderCount: orders.length,
      failureReason: null,
      startedAt: `${businessDate}T12:00:00+07:00`,
      snapshotCompletedAt: `${businessDate}T12:00:05+07:00`,
      completedAt: `${businessDate}T12:01:00+07:00`,
      version: 1,
      orders: orders.map((o, index) => {
        const trace = traceOf(o);
        return {
          id: mockGuid(`${o.code}-run`),
          salesOrderId: mockGuid(o.code),
          orderCode: o.code,
          retailerId: mockGuid(o.retailerCode),
          acceptedAt: o.createdAt,
          deliveryDeadline: null,
          priorityRank: index + 1,
          status: trace.ok ? 'Fulfilled' : 'Short',
          shortageReason: trace.ok
            ? null
            : trace.lines
                .map((l, i) => (l.enough ? null : `Dòng ${i + 1} (${l.sku}) thiếu ${l.short} trên ${l.qty}.`))
                .filter(Boolean)[0] ?? null,
          lines: trace.lines.map((l, i) => ({
            id: lineId(o.code, l.sku),
            salesOrderLineId: mockGuid(`${o.code}-${l.sku}`),
            productId: mockGuid(l.sku),
            sku: l.sku,
            lineNumber: i + 1,
            orderedQuantity: l.qty,
            totalShelfLifeHours: l.shelfLifeDays * 24,
            effectiveMlorRatio: l.m,
            mlorSource: db.retailerMlor[o.retailerCode]?.[l.sku] != null ? 'RetailerProduct' : 'ProductDefault',
            baseNetUnitPrice: product(l.sku).basePrice,
            allocatedQuantity: l.allocated,
          })),
        };
      }),
    },
    orders,
    runId,
    lineId,
  };
}

/** The single proposal for that run: every chosen batch, and the price of each. */
/**
 * What an Admin has decided about a plan version in this browser session. The real server stores it;
 * the mock keeps it in memory so approving once is visible until the page is reloaded.
 */
const planDecisions = new Map<string, { status: string; approvedAt: string | null; reason: string | null }>();

export function decidePlanVersion(versionId: string, status: string, reason: string | null, now: string) {
  planDecisions.set(versionId, { status, approvedAt: status === 'Approved' ? now : null, reason });
}

/**
 * The run identifier is a hash of its business date, so it cannot be read backwards. The mock scans
 * a bounded window of dates for the one that produces this id; the real server simply looks it up.
 */
export function businessDateOfRun(runId: string): string | null {
  const start = new Date(`${MOCK_TODAY}T00:00:00Z`).getTime();
  for (let offset = -120; offset <= 120; offset++) {
    const date = new Date(start + offset * 86_400_000).toISOString().slice(0, 10);
    if (mockGuid(`run-${date}`) === runId) return date;
  }
  return null;
}

/** Plan version ids are hashed from the business date too, so the same bounded scan finds the run. */
export function findRunOfVersion(versionId: string): string {
  const start = new Date(`${MOCK_TODAY}T00:00:00Z`).getTime();
  for (let offset = -120; offset <= 120; offset++) {
    const date = new Date(start + offset * 86_400_000).toISOString().slice(0, 10);
    if (mockGuid(`ver-${date}`) === versionId) return mockGuid(`run-${date}`);
  }
  return versionId;
}

export function planVersionsOf(runId: string) {
  const businessDate = businessDateOfRun(runId);
  if (businessDate == null) return [];
  const { run, orders, lineId } = allocationRunOf(businessDate);
  const tiers = [...db.settings.batchDiscountTiers].sort((a, b) => a.maxRemainingPct - b.maxRemainingPct);
  const allocations: unknown[] = [];
  const prices: unknown[] = [];
  let total = 0;

  orders.forEach((o) => {
    const trace = traceOf(o);
    if (!trace.ok) return;
    trace.lines.forEach((l) => {
      const base = product(l.sku).basePrice;
      l.allocations.forEach((a, sequence) => {
        const remainingPct = Math.max(0, Math.round((a.remainingDays / l.shelfLifeDays) * 10000) / 100);
        const tier = tiers.find((t) => remainingPct < t.maxRemainingPct);
        const perUnit = tier ? Math.round((base * tier.discountPct) / 100) : 0;
        const finalUnit = base - perUnit;
        allocations.push({
          allocationRunLineId: lineId(o.code, l.sku),
          batchId: mockGuid(a.batchCode),
          batchCode: a.batchCode,
          warehouseId: mockGuid(a.warehouseCode),
          warehouseCode: a.warehouseCode,
          quantity: a.qty,
          sequence: sequence + 1,
          estimatedArrivalAt: `${DISPATCH_DATE}T09:00:00+07:00`,
          remainingShelfLifeHours: a.remainingDays * 24,
          weightedScore: a.score ?? 0,
        });
        prices.push({
          allocationRunLineId: lineId(o.code, l.sku),
          batchId: mockGuid(a.batchCode),
          warehouseId: mockGuid(a.warehouseCode),
          quantity: a.qty,
          baseNetUnitPrice: base,
          remainingShelfLifePercent: remainingPct,
          shelfLifeDiscountTierId: tier ? mockGuid(`tier-${tier.maxRemainingPct}`) : null,
          discountType: tier ? 'Percent' : null,
          discountValue: tier ? tier.discountPct : null,
          shelfLifeDiscountPerUnit: perUnit,
          finalNetUnitPrice: finalUnit,
          amount: finalUnit * a.qty,
          discountTableVersion: 1,
          explanation: tier
            ? `Còn ${remainingPct}% hạn dùng, rơi vào bậc dưới ${tier.maxRemainingPct}% → giảm ${tier.discountPct}%.`
            : `Còn ${remainingPct}% hạn dùng, không khớp bậc nào.`,
        });
        total += finalUnit * a.qty;
      });
    });
  });

  const versionId = mockGuid(`ver-${businessDate}`);
  const decision = planDecisions.get(versionId);
  return [
    {
      id: versionId,
      allocationRunId: runId,
      runCode: run.runCode,
      versionNumber: 1,
      status: decision?.status ?? 'AwaitingApproval',
      pricedAt: `${businessDate}T12:00:30+07:00`,
      fulfilledOrderCount: run.orders.filter((o) => o.status === 'Fulfilled').length,
      shortOrderCount: run.orders.filter((o) => o.status === 'Short').length,
      totalFinalAmount: total,
      approvedByUserId: decision?.approvedAt ? mockGuid('admin') : null,
      approvedAt: decision?.approvedAt ?? null,
      recalculationReason: decision?.reason ?? null,
      version: decision ? 1 : 0,
      prices,
      allocations,
    },
  ];
}

// ---------------------------------------------------------------------------- run picking (F43)

const PICKED_FROM: string[] = ['Picking', 'Shipped', 'Delivering', 'Delivered', 'Completed'];
const LEFT_FROM: string[] = ['Shipped', 'Delivering', 'Delivered', 'Completed'];
const IN_RUN: string[] = ['Approved', ...PICKED_FROM];

/** Orders a run issued picking sheets for, oldest first, as the run itself ranked them. */
const runOrders = () =>
  db.orders
    .filter((o) => !o.archived && IN_RUN.includes(o.status))
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.code.localeCompare(b.code));

/**
 * The picking sheets of one run: one per warehouse, not one per order.
 *
 * A run approves allocations across every order it filled, and the sheet is cut per warehouse:
 * each gather is one trip to one batch, and that gather splits back to the orders the run gave it
 * to. That is why an order cannot be read as ready from its own rows - its warehouse closes the
 * sheet for every order on it at once.
 */
export function runPickingSheetsOf(businessDate: string) {
  const runId = mockGuid(`run-${businessDate}`);
  const planVersionId = mockGuid(`plan-${businessDate}-1`);

  interface Row { sku: string; batchCode: string; orderCode: string; orderId: string; qty: number; picked: number }
  const byWarehouse = new Map<string, Row[]>();

  runOrders().forEach((o) => {
    const picked = PICKED_FROM.includes(o.status);
    traceOf(o).lines.forEach((l) =>
      l.allocations.forEach((a) => {
        const rows = byWarehouse.get(a.warehouseCode) ?? [];
        rows.push({
          sku: a.sku, batchCode: a.batchCode, orderCode: o.code, orderId: mockGuid(o.code),
          qty: a.qty, picked: picked ? a.qty : 0,
        });
        byWarehouse.set(a.warehouseCode, rows);
      }),
    );
  });

  return [...byWarehouse.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([warehouseCode, rows], index) => {
      const wh = db.warehouses.find((x) => x.code === warehouseCode)!;
      const pickingCode = `PS-${businessDate.replace(/-/g, '')}-${warehouseCode}-01`;

      const gatherKeys = [...new Set(rows.map((r) => `${r.sku}|${r.batchCode}`))].sort();
      const gathers = gatherKeys.map((key) => {
        const [sku, batchCode] = key.split('|');
        const mine = rows.filter((r) => r.sku === sku && r.batchCode === batchCode);
        const required = mine.reduce((a, r) => a + r.qty, 0);
        const picked = mine.reduce((a, r) => a + r.picked, 0);
        return {
          id: mockGuid(`${pickingCode}-${key}`),
          productId: mockGuid(sku),
          sku,
          // Never merged away: two batches of one SKU stay two gathers, because the batch is what
          // the allocation and its approved price were decided on.
          batchId: mockGuid(batchCode),
          batchCode,
          requiredQuantity: required,
          pickedQuantity: picked,
          status: picked >= required ? 'Picked' : 'Pending',
          splits: mine.map((r) => ({
            id: mockGuid(`${pickingCode}-${key}-${r.orderCode}`),
            allocationRunAllocationId: mockGuid(`${r.orderCode}-${key}-alloc`),
            allocationPlanPriceId: mockGuid(`${r.orderCode}-${key}-price`),
            salesOrderId: r.orderId,
            orderCode: r.orderCode,
            quantity: r.qty,
            pickedQuantity: r.picked,
          })),
        };
      });

      const total = gathers.reduce((a, g) => a + g.requiredQuantity, 0);
      const done = gathers.reduce((a, g) => a + g.pickedQuantity, 0);
      const status = done === 0 ? 'Issued' : done < total ? 'Picking' : 'Ready';

      return {
        id: mockGuid(pickingCode),
        pickingCode,
        allocationRunId: runId,
        allocationPlanVersionId: planVersionId,
        warehouseId: mockGuid(wh.code),
        status,
        version: index + 1,
        issuedAt: `${businessDate}T12:05:00+07:00`,
        startedAt: done > 0 ? `${businessDate}T13:00:00+07:00` : null,
        completedAt: status === 'Ready' ? `${businessDate}T13:40:00+07:00` : null,
        completedByUserId: null,
        exceptionType: null,
        exceptionNote: null,
        gathers,
      };
    });
}

// ------------------------------------------------------------- readiness (F93) and parts (F92)

/**
 * Whether a whole order may leave, and what is holding it.
 *
 * A part exists only once its warehouse closes the sheet, so a warehouse still picking is reported
 * with a null shipment id rather than left out - leaving it out is what once let a half-picked
 * order read as ready, since nothing then looked unfinished.
 */
export function orderReadinessOf(o: DbOrder) {
  const sheets = runPickingSheetsOf(MOCK_TODAY);
  const codes = [...new Set(traceOf(o).lines.flatMap((l) => l.allocations.map((a) => a.warehouseCode)))].sort();
  const hasLeft = LEFT_FROM.includes(o.status);

  const parts = codes.map((warehouseCode) => {
    const sheet = sheets.find((s) => s.warehouseId === mockGuid(warehouseCode));
    const closed = sheet?.status === 'Ready';
    const status = hasLeft ? 'Issued' : closed ? 'Ready' : 'WaitingToPick';
    const exists = hasLeft || closed;
    return {
      shipmentId: exists ? mockGuid(`${o.code}-${warehouseCode}-shipment`) : null,
      shipmentCode: exists ? `PG-${o.code.replace('DH-', '')}-${warehouseCode}` : null,
      warehouseId: mockGuid(warehouseCode),
      warehouseCode,
      status,
      exceptionReason: null as string | null,
    };
  });

  const reasons: string[] = [];
  parts
    .filter((p) => p.status === 'WaitingToPick')
    .forEach((p) => reasons.push(`Kho ${p.warehouseCode} chưa soạn xong phần hàng của đơn.`));

  // Only a prepaid order is gated on payment: credit is settled on terms and COD on delivery.
  const paymentSettled = o.paymentMethod !== 'Prepaid' || !!o.prepaidChannel;
  if (!paymentSettled) reasons.push('Đơn trả trước chưa thanh toán đủ, chưa đủ điều kiện xuất kho.');

  return {
    salesOrderId: mockGuid(o.code),
    orderCode: o.code,
    isReady: reasons.length === 0,
    paymentSettled,
    hasException: parts.some((p) => p.status === 'Exception'),
    blockingReasons: reasons,
    parts,
  };
}
