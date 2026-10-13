import { db } from '../fixtures';
import type { DbBatchDiscount, DbPromotion } from '../fixtures/types';
import { MockRouter, conflict, notFound, paginate, validation } from '../router';
import { actor, nextSeq, product, requireRole, retailer } from './common';
import { batchDto } from './inventory';
import { pricingOf } from './orderView';
import { priceLines } from '../engines/pricing';
import { MOCK_TODAY, yymmdd } from '../engines/clock';

const findPromo = (code: string) => db.promotions.find((p) => p.code === code) ?? (() => { throw notFound(`Chương trình ${code}`); })();
const promoSummary = (p: DbPromotion) => ({
  code: p.code, name: p.name, type: p.type, validFrom: p.validFrom, validTo: p.validTo, status: p.status,
  customerCount: p.retailerCodes ? p.retailerCodes.length : null, skuCount: p.type === 'PerSku' ? p.rules.length : p.groupSkus.length,
});
function promoDetail(p: DbPromotion) {
  const applied = db.orders
    .filter((o) => o.status !== 'Rejected')
    .flatMap((o) => {
      const a = pricingOf(o).promotions.find((x) => x.code === p.code);
      return a ? [{ orderCode: o.code, retailerName: retailer(o.retailerCode).name, salesName: o.salesName, createdAt: o.createdAt, detail: a.detail, amount: a.amount }] : [];
    });
  return {
    ...promoSummary(p), rules: p.rules.map((r) => ({ ...r, productName: product(r.sku).name })),
    group: p.type === 'Group' ? { skus: p.groupSkus, minQty: p.groupMinQty, discountPct: p.groupDiscountPct } : null,
    retailers: p.retailerCodes ? p.retailerCodes.map((c) => ({ code: c, name: retailer(c).name })) : null,
    appliedOrders: applied, totalDiscount: applied.reduce((a, x) => a + x.amount, 0),
  };
}

const tierFor = (pct: number) => [...db.settings.batchDiscountTiers].sort((a, b) => a.maxRemainingPct - b.maxRemainingPct).find((t) => pct <= t.maxRemainingPct)?.discountPct ?? 0;
const discountDto = (d: DbBatchDiscount) => {
  const b = db.batches.find((x) => x.code === d.batchCode)!;
  const dto = batchDto(b);
  return { ...d, warehouseName: dto.warehouseName, warehouseCode: dto.warehouseCode, sku: dto.sku, productName: dto.productName, remainingDays: dto.remainingDays, remainingPct: dto.remainingPct };
};

export function registerPricing(r: MockRouter) {
  r.get('/promotions', ({ query }) => paginate(db.promotions.map(promoSummary), query, (p) => `${p.code} ${p.name}`));
  r.get('/promotions/:code', ({ params }) => promoDetail(findPromo(params.code)));
  r.post('/promotions', ({ body }) => {
    const errors: Record<string, string[]> = {};
    const name = String(body?.name ?? '').trim();
    if (!name) errors.name = ['Bắt buộc nhập.'];
    if (!body?.validFrom) errors.validFrom = ['Bắt buộc nhập.'];
    if (!body?.validTo) errors.validTo = ['Bắt buộc nhập.'];
    if (body?.validFrom && body?.validTo && body.validTo < body.validFrom) errors.validTo = ['Ngày kết thúc phải sau ngày bắt đầu.'];
    const type = body?.type === 'Group' ? 'Group' : 'PerSku';
    const rules = ((body?.rules ?? []) as { sku: string; minQty: number; discountPct: number }[]).map((x) => ({ sku: x.sku, minQty: Number(x.minQty), discountPct: Number(x.discountPct) }));
    if (type === 'PerSku' && (!rules.length || rules.some((x) => !(x.minQty > 0) || !(x.discountPct > 0))) ) errors.rules = ['Mỗi dòng cần số lượng tối thiểu và % giảm.'];
    if (type === 'Group' && (!(body?.groupSkus ?? []).length || !(Number(body?.groupMinQty) > 0) || !(Number(body?.groupDiscountPct) > 0))) errors.groupSkus = ['Chọn sản phẩm, số lượng tối thiểu và % giảm chung.'];
    if (Object.keys(errors).length) throw validation(errors);
    const code = nextSeq(db.promotions.map((p) => p.code), 'KM-', 3);
    const p: DbPromotion = {
      code, name, type, validFrom: body.validFrom, validTo: body.validTo, retailerCodes: (body.retailerCodes ?? []).length ? body.retailerCodes : null, status: 'Running',
      rules: type === 'PerSku' ? rules : [], groupSkus: type === 'Group' ? body.groupSkus : [], groupMinQty: type === 'Group' ? Number(body.groupMinQty) : 0, groupDiscountPct: type === 'Group' ? Number(body.groupDiscountPct) : 0,
    };
    db.promotions.push(p);
    return promoDetail(p);
  });
  r.post('/promotions/:code/pause', (req) => { requireRole(req, ['Admin']); const p = findPromo(req.params.code); p.status = 'Paused'; return promoDetail(p); });
  r.post('/promotions/:code/activate', (req) => { requireRole(req, ['Admin']); const p = findPromo(req.params.code); if (p.status === 'Ended') throw conflict('Chương trình đã hết hiệu lực.'); p.status = 'Running'; return promoDetail(p); });

  r.post('/pricing/quote', ({ body }) => priceLines(body?.lines ?? [], String(body?.retailerCode ?? ''), db.promotions.filter((p) => p.status === 'Running'), db.products));

  // ---- batch discounts (KMB) by % shelf life remaining ----
  r.get('/batch-discounts/suggestions', ({ query }) =>
    db.batches
      .filter((b) => !b.disposed && b.available > 0)
      .map(batchDto)
      .filter((b) => b.remainingDays > 0 && (!query.warehouse || b.warehouseCode === query.warehouse) && (!query.sku || b.sku === query.sku) && (!query.maxPct || b.remainingPct <= Number(query.maxPct)))
      .sort((a, b) => a.remainingPct - b.remainingPct)
      .map((b) => ({
        batchCode: b.code, warehouseCode: b.warehouseCode, warehouseName: b.warehouseName, sku: b.sku, productName: b.productName, expiry: b.expiry, remainingDays: b.remainingDays, remainingPct: b.remainingPct,
        available: b.available, suggestedPct: tierFor(b.remainingPct), basePrice: product(b.sku).basePrice, activeDiscountPct: b.discountPct,
      })),
  );
  r.get('/batch-discounts', ({ query }) => paginate(db.batchDiscounts.map(discountDto), query, (d) => `${d.code} ${d.batchCode} ${d.productName} ${d.warehouseName}`));
  r.post('/batch-discounts', (req) => {
    requireRole(req, ['Admin']);
    const items = (req.body?.items ?? []) as { batchCode: string; discountPct: number }[];
    const errors: Record<string, string[]> = {};
    if (!items.length) errors.items = ['Chọn ít nhất một batch.'];
    if (items.some((i) => !(Number(i.discountPct) > 0 && Number(i.discountPct) < 100))) errors.items = ['% giảm phải nằm trong (0, 100).'];
    if (!req.body?.validFrom || !req.body?.validTo) errors.validTo = ['Chọn thời gian hiệu lực.'];
    if (Object.keys(errors).length) throw validation(errors);
    const created = items.map((i) => {
      db.batchDiscounts.filter((d) => d.batchCode === i.batchCode && d.status === 'Active').forEach((d) => (d.status = 'Ended'));
      const code = nextSeq(db.batchDiscounts.map((d) => d.code).concat([`KMB-${yymmdd(MOCK_TODAY)}-00`]), `KMB-${yymmdd(MOCK_TODAY)}-`, 2);
      const d: DbBatchDiscount = { code, batchCode: i.batchCode, discountPct: Number(i.discountPct), validFrom: req.body.validFrom, validTo: req.body.validTo, createdBy: actor(req).name, status: 'Active' };
      db.batchDiscounts.unshift(d);
      return discountDto(d);
    });
    return { items: created };
  });
  r.post('/batch-discounts/:code/stop', (req) => {
    requireRole(req, ['Admin']);
    const d = db.batchDiscounts.find((x) => x.code === req.params.code) ?? (() => { throw notFound(`Giảm giá ${req.params.code}`); })();
    d.status = 'Ended';
    return discountDto(d);
  });
}
