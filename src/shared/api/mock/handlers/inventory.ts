import { db } from '../fixtures';
import type { DbBatch, DbDisposal, DbReceipt, DbTransfer, DbWarehouse } from '../fixtures/types';
import { MockRouter, businessRule, conflict, notFound, paginate, validation } from '../router';
import { actor, nextSeq, product, requireRole, warehouse, warehouseName } from './common';
import { MOCK_TODAY, stamp, yymmdd } from '../engines/clock';
import { planRotation, type RotationPlan } from '../engines/rotation';
import { daysBetween } from '../../../lib/dates';
import { IdFormat } from '../../../lib/ids';
import { quoteTransit } from '../engines/transit';

// ---------- batches ----------
export function batchDto(b: DbBatch) {
  const p = product(b.sku);
  const remaining = daysBetween(MOCK_TODAY, b.expiry);
  const discount = db.batchDiscounts.find((d) => d.batchCode === b.code && d.status === 'Active');
  return {
    code: b.code, warehouseCode: b.warehouseCode, warehouseName: warehouseName(b.warehouseCode), sku: b.sku, productName: p.name, expiry: b.expiry,
    onHand: b.disposed ? 0 : b.available + b.held, held: b.disposed ? 0 : b.held, available: b.disposed ? 0 : b.available, shelfLifeDays: p.shelfLifeDays,
    remainingDays: remaining, remainingPct: Math.round((remaining / p.shelfLifeDays) * 100),
    expiryStatus: b.disposed ? 'Disposed' : remaining <= 0 ? 'Expired' : remaining <= p.nearExpiryDays ? 'NearExpiry' : 'Normal',
    discountPct: discount?.discountPct ?? null, discountUntil: discount?.validTo ?? null, discountCode: discount?.code ?? null,
  };
}
const findBatch = (code: string) => db.batches.find((b) => b.code === code) ?? (() => { throw notFound(`Batch ${code}`); })();

// ---------- warehouses ----------
const whDto = (w: DbWarehouse) => ({ ...w, batchCount: db.batches.filter((b) => b.warehouseCode === w.code).length });
const findWh = (code: string) => db.warehouses.find((w) => w.code === code) ?? (() => { throw notFound(`Kho ${code}`); })();

// ---------- documents ----------
const receiptDto = (x: DbReceipt) => ({ ...x, warehouseName: warehouseName(x.warehouseCode), batchCount: x.lines.length, totalQty: x.lines.reduce((a, l) => a + l.qty, 0), lines: x.lines.map((l) => ({ ...l, productName: product(l.sku).name })) });
const disposalDto = (x: DbDisposal) => ({
  ...x, warehouseName: warehouseName(x.warehouseCode), batchCount: x.lines.length, totalQty: x.lines.reduce((a, l) => a + l.qty, 0),
  totalValue: x.lines.reduce((a, l) => a + l.qty * product(l.sku).basePrice, 0), lines: x.lines.map((l) => ({ ...l, productName: product(l.sku).name })),
});
const transferDto = (t: DbTransfer) => {
  const from = warehouse(t.fromWarehouse), to = warehouse(t.toWarehouse);
  return {
    ...t, fromWarehouseName: from.name, fromType: from.type, fromKeeper: from.keeperName, toWarehouseName: to.name, toType: to.type, toKeeper: to.keeperName, productName: product(t.sku).name,
    destinationBatch: IdFormat.batch(t.toWarehouse, t.sku, t.expiry),
  };
};
const findTransfer = (code: string) => db.transfers.find((t) => t.code === code) ?? (() => { throw notFound(`Phiếu điều chuyển ${code}`); })();

function replenishmentSuggestions() {
  const min = db.settings.minRegionalStock;
  const out: { toWarehouse: string; toWarehouseName: string; fromWarehouse: string; fromWarehouseName: string; sku: string; productName: string; sourceBatch: string; expiry: string; have: number; min: number; qty: number }[] = [];
  const central = db.warehouses.filter((w) => w.type === 'Central').map((w) => w.code);
  db.warehouses.filter((w) => w.type !== 'Central' && w.status === 'Active').forEach((w) => {
    ['SKU001', 'SKU004', 'SKU007'].forEach((sku) => {
      const have = db.batches.filter((b) => !b.disposed && b.warehouseCode === w.code && b.sku === sku && daysBetween(MOCK_TODAY, b.expiry) > 0).reduce((a, b) => a + b.available, 0);
      const inTransit = db.transfers.some((x) => x.toWarehouse === w.code && x.sku === sku && x.status === 'InTransit');
      if (have >= min || have === 0 || inTransit) return;
      const src = db.batches.filter((b) => !b.disposed && central.includes(b.warehouseCode) && b.sku === sku && b.available > 0 && daysBetween(MOCK_TODAY, b.expiry) > 0).sort((a, b) => (a.expiry < b.expiry ? -1 : 1))[0];
      if (!src) return;
      out.push({ toWarehouse: w.code, toWarehouseName: w.name, fromWarehouse: src.warehouseCode, fromWarehouseName: warehouseName(src.warehouseCode), sku, productName: product(sku).name, sourceBatch: src.code, expiry: src.expiry, have, min, qty: Math.min(src.available, Math.ceil((min - have) / 10) * 10) });
    });
  });
  return out;
}

// ---------- rotation ----------
const plans = (): RotationPlan[] =>
  planRotation({ batches: db.batches, warehouses: db.warehouses, products: db.products, velocity: db.velocity, whPairs: db.whPairs, bands: db.transit.bands, settings: db.settings, today: MOCK_TODAY, qtyOverrides: db.rotationQty });

const rowId = (batch: string, to: string) => `${batch}~${to}`;
interface ProposalRow {
  id: string; batchCode: string; sku: string; productName: string; fromWarehouseCode: string; fromWarehouseName: string; excess: number; expiry: string; runDate: string;
  toWarehouseCode: string | null; toWarehouseName: string | null; km: number; qty: number; maxQty: number; score: number; salvage: number; tripCost: number;
  status: 'Proposed' | 'Approved' | 'Skipped' | 'DiscountSuggested' | 'NoDestination'; transferCode: string | null;
}
function proposalRows(): ProposalRow[] {
  return plans().flatMap((pl) => {
    const common = { batchCode: pl.batch.code, sku: pl.batch.sku, productName: pl.product.name, fromWarehouseCode: pl.batch.warehouseCode, fromWarehouseName: warehouseName(pl.batch.warehouseCode), excess: pl.excess, expiry: pl.batch.expiry, runDate: MOCK_TODAY };
    const rows: ProposalRow[] = pl.assigns.map((a) => {
      const st = db.rotationStatus[a.key];
      return { id: rowId(pl.batch.code, a.to), ...common, toWarehouseCode: a.to, toWarehouseName: a.toName, km: a.km, qty: a.qty, maxQty: a.maxQty, score: a.score, salvage: a.salvage, tripCost: a.trip, status: st?.status ?? 'Proposed', transferCode: st?.transferCode ?? null };
    });
    if (pl.leftover > 0)
      rows.push({ id: rowId(pl.batch.code, 'DISCOUNT'), ...common, toWarehouseCode: null, toWarehouseName: null, km: 0, qty: pl.leftover, maxQty: 0, score: 0, salvage: 0, tripCost: 0, status: pl.assigns.length ? 'DiscountSuggested' : 'NoDestination', transferCode: null });
    return rows;
  });
}
const findProposal = (id: string) => proposalRows().find((x) => x.id === id) ?? (() => { throw notFound(`Đề xuất ${id}`); })();
const keyOf = (id: string) => id.replace('~', '>');

function rotationTrace(batchCode: string) {
  const pl = plans().find((x) => x.batch.code === batchCode) ?? (() => { throw notFound(`Batch ${batchCode}`); })();
  const R = db.settings.rotation;
  return {
    batchCode, sku: pl.batch.sku, productName: pl.product.name, shelfLifeDays: pl.product.shelfLifeDays, fromWarehouseName: warehouseName(pl.batch.warehouseCode), expiry: pl.batch.expiry,
    remainingDays: pl.remainingDays, quantity: pl.batch.available, olderAhead: pl.olderAhead, sellable: pl.sellable, excess: pl.excess, unitCost: pl.unitCost,
    weights: { wE: R.wE, wD: R.wD, wQ: R.wQ }, minQty: R.minQty, roundTo: R.roundTo, leftover: pl.leftover,
    step1: pl.capacity.rows.map((x) => ({ group: x.label, velocity: x.v, m: x.m, mlorDays: x.mlor, windowDays: x.window, sellable: x.sell })),
    step2: pl.candidates.map((c) => ({
      warehouseCode: c.w, warehouseName: c.name, km: c.km, transitDays: c.t?.days ?? null, remainingAtDest: c.L ?? null, salesCapacity: c.capTotal || null, qAhead: c.qa,
      receivingCapacity: c.capTotal ? c.N : null, accepted: c.ok, reason: c.why,
    })),
    step3: pl.scores.map((s) => ({ warehouseName: s.name, tentativeQty: s.tentative, fE: s.fE, fD: s.fD, fQ: s.fQ, score: s.score })),
    step4: pl.turns.map((t) => ({ turn: t.turn, warehouseName: t.name, excessLeft: t.left, qty: t.qty, after: t.after, note: t.note })),
  };
}

export function registerInventory(r: MockRouter) {
  // ---- warehouses ----
  r.get('/warehouses', ({ query }) => paginate(db.warehouses.map(whDto), query, (w) => `${w.code} ${w.name} ${w.address} ${w.keeperName}`));
  r.get('/warehouses/:code', ({ params }) => {
    const w = findWh(params.code);
    const retailerDistances = db.retailers.map((x) => {
      const km = db.retailerDist[x.code]?.[w.code] ?? 0;
      const q = quoteTransit(km, 'retailer', db.transit.bands, db.settings.dmaxRetailerKm);
      return { retailerCode: x.code, retailerName: x.name, km, transitDays: q?.days ?? null, withinRange: !!q };
    });
    return { ...whDto(w), retailerDistances };
  });
  const readWh = (body: Record<string, unknown>, existing?: DbWarehouse) => {
    const errors: Record<string, string[]> = {};
    const code = existing ? existing.code : String(body.code ?? '').trim().toUpperCase();
    if (!existing) {
      if (!/^WH-[A-Z]{2,4}$/.test(code)) errors.code = ['Định dạng WH- + 2–4 chữ in hoa.'];
      else if (db.warehouses.some((w) => w.code === code)) errors.code = ['Mã đã tồn tại.'];
    }
    if (!String(body.name ?? '').trim()) errors.name = ['Bắt buộc nhập.'];
    if (!String(body.address ?? '').trim()) errors.address = ['Bắt buộc nhập.'];
    if (Number.isNaN(Number(body.lat)) || body.lat === '' || body.lat === undefined) errors.lat = ['Phải là số.'];
    if (Number.isNaN(Number(body.lng)) || body.lng === '' || body.lng === undefined) errors.lng = ['Phải là số.'];
    if (Object.keys(errors).length) throw validation(errors);
    return { code, name: String(body.name), address: String(body.address), lat: Number(body.lat), lng: Number(body.lng), type: (body.type as 'Central' | 'Regional') ?? 'Regional', keeperName: (body.keeperName as string) || null, capacityPallets: Number(body.capacityPallets) || 0, status: (body.status as 'Active' | 'Paused') ?? 'Active' };
  };
  r.post('/warehouses', ({ body }) => {
    const w = readWh(body ?? {});
    db.warehouses.push(w);
    db.velocity[w.code] = {};
    Object.keys(db.retailerDist).forEach((k) => (db.retailerDist[k][w.code] = 15 + (w.code.charCodeAt(4) % 20)));
    return whDto(w);
  });
  r.put('/warehouses/:code', ({ params, body }) => {
    const w = findWh(params.code);
    Object.assign(w, readWh(body ?? {}, w));
    return whDto(w);
  });

  // ---- batches & labels ----
  r.get('/batches', ({ query }) => {
    let rows = db.batches.map(batchDto);
    if (query.warehouse) rows = rows.filter((b) => b.warehouseCode === query.warehouse);
    if (query.sku) rows = rows.filter((b) => b.sku === query.sku);
    if (query.expiryStatus) rows = rows.filter((b) => b.expiryStatus === query.expiryStatus);
    return paginate(rows, query, (b) => `${b.code} ${b.sku} ${b.productName} ${b.warehouseName}`);
  });
  r.get('/batches/:code', ({ params }) => {
    const b = findBatch(params.code);
    const dto = batchDto(b);
    const rc = db.receipts.find((x) => x.lines.some((l) => l.batchCode === b.code));
    const history = [
      { at: rc?.receivedAt ?? `${b.expiry}T07:30`, type: 'Nhập kho', document: rc?.code ?? 'PN-' + yymmdd(b.expiry) + '-01', qty: b.available + b.held + 20, by: warehouse(b.warehouseCode).keeperName ?? '—' },
      { at: '2026-09-26T08:40', type: 'Xuất kho', document: 'DH-001021A', qty: -20, by: warehouse(b.warehouseCode).keeperName ?? '—' },
    ];
    return { ...dto, history };
  });
  r.get('/labels/:code', ({ params }) => {
    const t = db.transfers.find((x) => x.labelCode === params.code);
    if (!t) throw notFound(`Tem ${params.code}`);
    return { code: params.code, batchCode: t.sourceBatch, sku: t.sku, productName: product(t.sku).name, expiry: t.expiry, qty: t.qty, transferCode: t.code };
  });

  // ---- goods receipts ----
  r.get('/goods-receipts', ({ query }) => paginate([...db.receipts].sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1)).map(receiptDto), query, (x) => `${x.code} ${warehouseName(x.warehouseCode)} ${x.lines.map((l) => l.batchCode).join(' ')}`));
  r.get('/goods-receipts/:code', ({ params }) => receiptDto(db.receipts.find((x) => x.code === params.code) ?? (() => { throw notFound(`Phiếu nhập ${params.code}`); })()));
  r.post('/goods-receipts', (req) => {
    const { body } = req;
    const w = findWh(String(body?.warehouseCode ?? ''));
    const lines = ((body?.lines ?? []) as { sku: string; expiry: string; qty: number; labels?: number; lot?: string }[]).filter((l) => Number(l.qty) > 0 && l.expiry);
    if (!lines.length) throw validation({ lines: ['Nhập ít nhất một dòng có hạn sử dụng và số thùng.'] });
    const code = nextSeq(db.receipts.map((x) => x.code).filter((c) => c.startsWith('PN-' + yymmdd(MOCK_TODAY))).concat([`PN-${yymmdd(MOCK_TODAY)}-00`]), `PN-${yymmdd(MOCK_TODAY)}-`, 2);
    const rc: DbReceipt = { code, warehouseCode: w.code, receivedAt: stamp(), receivedBy: actor(req).name, note: String(body?.note ?? ''), lines: [] };
    lines.forEach((l) => {
      product(l.sku);
      const bc = IdFormat.batch(w.code, l.sku, l.expiry);
      const ex = db.batches.find((b) => b.code === bc);
      if (ex) ex.available += Number(l.qty);
      else db.batches.push({ code: bc, warehouseCode: w.code, sku: l.sku, expiry: l.expiry, available: Number(l.qty), held: 0, disposed: false, manufacturerLot: l.lot ?? '' });
      rc.lines.push({ sku: l.sku, batchCode: bc, expiry: l.expiry, qty: Number(l.qty), labels: Math.max(1, Number(l.labels) || 1), lot: l.lot ?? '' });
    });
    db.receipts.unshift(rc);
    return receiptDto(rc);
  });
  r.post('/goods-receipts/:code/approve', ({ params }) => receiptDto(db.receipts.find((x) => x.code === params.code) ?? (() => { throw notFound(`Phiếu nhập ${params.code}`); })()));

  // ---- transfers ----
  r.get('/transfers/suggestions', () => replenishmentSuggestions());
  r.get('/transfers', ({ query }) => paginate(db.transfers.map(transferDto), query, (t) => `${t.code} ${t.sku} ${t.sourceBatch} ${warehouseName(t.fromWarehouse)} ${warehouseName(t.toWarehouse)}`));
  r.get('/transfers/:code', ({ params }) => transferDto(findTransfer(params.code)));
  r.post('/transfers', (req) => {
    const { body } = req;
    const errors: Record<string, string[]> = {};
    const from = db.warehouses.find((w) => w.code === body?.fromWarehouse), to = db.warehouses.find((w) => w.code === body?.toWarehouse);
    if (!from) errors.fromWarehouse = ['Chọn kho đi.'];
    if (!to) errors.toWarehouse = ['Chọn kho đến.'];
    if (from && to && from.code === to.code) errors.toWarehouse = ['Kho đến phải khác kho đi.'];
    const src = db.batches.find((b) => b.code === body?.sourceBatch);
    if (!src) errors.sourceBatch = ['Kho đi không còn batch khả dụng.'];
    const qty = Number(body?.qty);
    if (!(qty > 0)) errors.qty = ['Phải lớn hơn 0.']; else if (src && qty > src.available) errors.qty = [`Vượt khả dụng ${src.available} thùng.`];
    if (Object.keys(errors).length) throw validation(errors);
    const code = nextSeq(db.transfers.map((t) => t.code).concat([`DC-${yymmdd(MOCK_TODAY)}-00`]), `DC-${yymmdd(MOCK_TODAY)}-`, 2);
    const t: DbTransfer = { code, kind: body?.kind ?? 'Replenishment', fromWarehouse: from!.code, toWarehouse: to!.code, sku: src!.sku, sourceBatch: src!.code, expiry: src!.expiry, qty, createdAt: stamp(), createdBy: actor(req).name, status: 'InTransit', labelCode: IdFormat.label(205 + db.transfers.length), receivedNote: '', score: null, note: String(body?.note ?? '') };
    db.transfers.unshift(t);
    return transferDto(t);
  });
  r.post('/transfers/:code/ship', ({ params }) => transferDto(findTransfer(params.code)));
  r.post('/transfers/:code/receive', (req) => {
    const t = findTransfer(req.params.code);
    if (t.status !== 'InTransit') throw conflict('Phiếu không ở trạng thái Đang vận chuyển.');
    t.status = 'Received';
    t.receivedNote = `${stamp().slice(8, 10)}/09/2026 ${stamp().slice(11)} · ${warehouse(t.toWarehouse).keeperName ?? actor(req).name} quét tem nhận`;
    return transferDto(t);
  });

  // ---- rotation (Admin approves the proposals of the 02:00 job) ----
  r.get('/rotation/proposals', ({ query }) => ({ runDate: query.runDate ?? MOCK_TODAY, jobRanAt: `${MOCK_TODAY}T02:00`, items: proposalRows() }));
  r.get('/rotation/proposals/:id', ({ params }) => {
    const proposal = findProposal(params.id);
    return { proposal, trace: rotationTrace(proposal.batchCode) };
  });
  r.post('/rotation/proposals/:id/approve', (req) => {
    requireRole(req, ['Admin']);
    const p = findProposal(req.params.id);
    if (p.status !== 'Proposed') throw conflict('Đề xuất đã được xử lý.');
    const code = nextSeq(db.transfers.map((t) => t.code).concat([`DC-${yymmdd(MOCK_TODAY)}-00`]), `DC-${yymmdd(MOCK_TODAY)}-`, 2);
    const t: DbTransfer = { code, kind: 'NearExpiryRotation', fromWarehouse: p.fromWarehouseCode, toWarehouse: p.toWarehouseCode!, sku: p.sku, sourceBatch: p.batchCode, expiry: p.expiry, qty: p.qty, createdAt: stamp(), createdBy: actor(req).name, status: 'InTransit', labelCode: IdFormat.label(205 + db.transfers.length), receivedNote: '', score: p.score, note: '' };
    db.transfers.unshift(t);
    db.rotationStatus[keyOf(p.id)] = { status: 'Approved', transferCode: code };
    return { ...p, status: 'Approved', transferCode: code };
  });
  r.post('/rotation/proposals/:id/skip', (req) => {
    requireRole(req, ['Admin']);
    const p = findProposal(req.params.id);
    if (p.status !== 'Proposed') throw conflict('Đề xuất đã được xử lý.');
    db.rotationStatus[keyOf(p.id)] = { status: 'Skipped', transferCode: null };
    return { ...p, status: 'Skipped' };
  });
  r.put('/rotation/proposals/:id', (req) => {
    requireRole(req, ['Admin']);
    const p = findProposal(req.params.id);
    if (p.status !== 'Proposed') throw conflict('Đề xuất đã được xử lý.');
    const qty = Number(req.body?.qty);
    const min = db.settings.rotation.minQty;
    if (Number.isNaN(qty)) throw validation({ qty: ['Phải là số.'] });
    if (qty < min) throw validation({ qty: [`Tối thiểu ${min} thùng.`] });
    if (qty > p.maxQty) throw validation({ qty: [`Tối đa ${p.maxQty} thùng.`] });
    db.rotationQty[keyOf(p.id)] = qty;
    return findProposal(p.id);
  });
  r.post('/rotation/run', () => ({ runDate: MOCK_TODAY, batchesWithExcess: plans().length, proposals: proposalRows().filter((x) => x.status === 'Proposed').length }));

  // ---- disposals (expired batches) ----
  r.get('/disposals/candidates', ({ query }) =>
    db.batches
      .filter((b) => !b.disposed && b.available + b.held > 0 && daysBetween(MOCK_TODAY, b.expiry) <= 0 && (!query.warehouse || b.warehouseCode === query.warehouse))
      .map((b) => ({ batchCode: b.code, warehouseCode: b.warehouseCode, warehouseName: warehouseName(b.warehouseCode), sku: b.sku, productName: product(b.sku).name, expiry: b.expiry, daysOverdue: -daysBetween(MOCK_TODAY, b.expiry), qty: b.available + b.held, value: (b.available + b.held) * product(b.sku).basePrice })),
  );
  r.get('/disposals', ({ query }) => paginate([...db.disposals].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(disposalDto), query, (x) => `${x.code} ${warehouseName(x.warehouseCode)} ${x.lines.map((l) => l.batchCode).join(' ')}`));
  r.get('/disposals/:code', ({ params }) => disposalDto(db.disposals.find((x) => x.code === params.code) ?? (() => { throw notFound(`Phiếu hủy ${params.code}`); })()));
  r.post('/disposals', (req) => {
    const codes = (req.body?.batchCodes ?? []) as string[];
    if (!codes.length) throw businessRule('Chọn ít nhất một batch hết hạn để lập phiếu hủy.');
    const batches = codes.map(findBatch);
    if (batches.some((b) => daysBetween(MOCK_TODAY, b.expiry) > 0)) throw businessRule('Chỉ hủy được batch đã hết hạn.');
    const created: DbDisposal[] = [];
    [...new Set(batches.map((b) => b.warehouseCode))].forEach((w) => {
      const code = nextSeq(db.disposals.map((x) => x.code).concat([`PH-${yymmdd(MOCK_TODAY)}-00`]), `PH-${yymmdd(MOCK_TODAY)}-`, 2);
      const d: DbDisposal = { code, warehouseCode: w, createdAt: stamp(), createdBy: actor(req).name, reason: 'Hết hạn sử dụng', method: req.body?.method ?? 'Tiêu hủy tại kho', lines: [] };
      batches.filter((b) => b.warehouseCode === w).forEach((b) => {
        d.lines.push({ sku: b.sku, batchCode: b.code, expiry: b.expiry, qty: b.available + b.held });
        b.disposed = true;
      });
      db.disposals.unshift(d);
      created.push(d);
    });
    return { items: created.map(disposalDto) };
  });
}
