import { db } from '../fixtures';
import type { DbBatchDiscount, DbPromotion } from '../fixtures/types';
import { MockRouter, conflict, notFound, paginate, validation } from '../router';
import { actor, mockGuid, nextSeq, product, requireRole } from './common';
import { batchDto } from './inventory';
import { priceLines } from '../engines/pricing';
import { MOCK_TODAY, yymmdd } from '../engines/clock';

const findPromo = (id: string) =>
  db.promotions.find((p) => mockGuid(p.code) === id) ?? (() => { throw notFound(`Chương trình ${id}`); })();

/** Mirrors PromotionResult: identifiers, one minimum and one percentage, plus what it applies to. */
const promoDto = (p: DbPromotion) => ({
  id: mockGuid(p.code),
  code: p.code,
  name: p.name,
  promotionType: 'Campaign',
  minimumQuantity: p.minQty,
  discountPercent: p.discountPct,
  startAt: p.validFrom,
  endAt: p.validTo,
  isActive: p.active,
  productIds: p.skus.map((sku) => mockGuid(sku)),
  categoryIds: p.categoryCodes.map((code) => mockGuid(code)),
  retailerIds: (p.retailerCodes ?? []).map((code) => mockGuid(code)),
  createdAt: p.validFrom,
  updatedAt: p.validFrom,
});

const tierFor = (pct: number) => [...db.settings.batchDiscountTiers].sort((a, b) => a.maxRemainingPct - b.maxRemainingPct).find((t) => pct <= t.maxRemainingPct)?.discountPct ?? 0;
const discountDto = (d: DbBatchDiscount) => {
  const b = db.batches.find((x) => x.code === d.batchCode)!;
  const dto = batchDto(b);
  return { ...d, warehouseName: dto.warehouseName, warehouseCode: dto.warehouseCode, sku: dto.sku, productName: dto.productName, remainingDays: dto.remainingDays, remainingPct: dto.remainingPct };
};

export function registerPricing(r: MockRouter) {
  // The real API returns a plain array here, not a paged envelope.
  r.get('/promotions', () => db.promotions.map(promoDto));
  r.get('/promotions/:id', ({ params }) => promoDto(findPromo(params.id)));
  r.post('/promotions', ({ body }) => {
    const errors: Record<string, string[]> = {};
    const name = String(body?.name ?? '').trim();
    const minQty = Number(body?.minimumQuantity);
    const pct = Number(body?.discountPercent);
    const skus = ((body?.productIds ?? []) as string[]);
    const cats = ((body?.categoryIds ?? []) as string[]);
    if (!name) errors.name = ['Bắt buộc nhập.'];
    if (!body?.startAt) errors.startAt = ['Bắt buộc nhập.'];
    if (!body?.endAt) errors.endAt = ['Bắt buộc nhập.'];
    if (body?.startAt && body?.endAt && body.endAt < body.startAt) errors.endAt = ['Ngày kết thúc phải sau ngày bắt đầu.'];
    if (!(minQty > 0)) errors.minimumQuantity = ['Phải lớn hơn 0.'];
    if (!(pct > 0 && pct < 100)) errors.discountPercent = ['% giảm phải trong khoảng (0, 100).'];
    // A promotion naming nothing would apply to nothing, so it is refused rather than stored.
    if (skus.length === 0 && cats.length === 0) errors.productIds = ['Chọn ít nhất một SKU hoặc một nhóm hàng.'];
    if (Object.keys(errors).length) throw validation(errors);

    const code = nextSeq(db.promotions.map((x) => x.code), 'KM-', 3);
    const p: DbPromotion = {
      code,
      name,
      validFrom: body.startAt,
      validTo: body.endAt,
      retailerCodes: ((body?.retailerIds ?? []) as string[]).length
        ? db.retailers.filter((r) => (body.retailerIds as string[]).includes(mockGuid(r.code))).map((r) => r.code)
        : null,
      active: true,
      minQty,
      discountPct: pct,
      skus: db.products.filter((x) => skus.includes(mockGuid(x.sku))).map((x) => x.sku),
      categoryCodes: db.categories.filter((c) => cats.includes(mockGuid(c.code))).map((c) => c.code),
    };
    db.promotions.push(p);
    return promoDto(p);
  });
  r.post('/promotions/:id/deactivate', (req) => { requireRole(req, ['Admin']); const p = findPromo(req.params.id); p.active = false; return promoDto(p); });
  r.post('/promotions/:id/activate', (req) => {
    requireRole(req, ['Admin']);
    const p = findPromo(req.params.id);
    if (new Date(p.validTo).getTime() < Date.now()) throw conflict('Chương trình đã hết hiệu lực.');
    p.active = true;
    return promoDto(p);
  });

  r.post('/pricing/quote', ({ body }) => priceLines(body?.lines ?? [], String(body?.retailerCode ?? ''), db.promotions.filter((p) => p.active), db.products));

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
