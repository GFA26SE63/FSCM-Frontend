import { db } from '../fixtures';
import type { DbGift, DbRedemption } from '../fixtures/types';
import { MockRouter, conflict, notFound, paginate, validation } from '../router';
import { actor, nextSeq, requireRole, retailer } from './common';
import { MOCK_TODAY, stamp, yymmdd } from '../engines/clock';

const account = (code: string) => db.loyalty.find((a) => a.retailerCode === code) ?? { retailerCode: code, balance: 0, ledger: [] };
const heldOf = (code: string) => db.redemptions.filter((x) => x.retailerCode === code && x.status === 'Requested').reduce((a, x) => a + x.points, 0);
const gift = (code: string) => db.gifts.find((g) => g.code === code) ?? (() => { throw notFound(`Quà ${code}`); })();

function balanceRow(code: string) {
  const a = account(code);
  const held = heldOf(code);
  const last = a.ledger.find((e) => e.kind === 'Earned');
  return {
    retailerCode: code, retailerName: retailer(code).name, balance: a.balance, held, available: a.balance - held, pendingOrders: a.ledger.filter((e) => e.kind === 'Pending').length,
    lastEarned: last ? { date: last.date, points: last.points ?? 0 } : null,
  };
}
const programDto = () => {
  const p = db.loyaltyProgram;
  return { ...p, pointRateVnd: db.settings.loyaltyPointRateVnd, gifts: db.gifts.filter((g) => g.status === 'Active') };
};
const redemptionDto = (x: DbRedemption) => {
  const g = gift(x.giftCode);
  const a = account(x.retailerCode);
  return { ...x, retailerName: retailer(x.retailerCode).name, giftName: g.name, balance: a.balance, held: heldOf(x.retailerCode), available: a.balance - heldOf(x.retailerCode) };
};
const findRedemption = (code: string) => db.redemptions.find((x) => x.code === code) ?? (() => { throw notFound(`Yêu cầu ${code}`); })();

export function registerLoyalty(r: MockRouter) {
  r.get('/loyalty/programs', () => [programDto()]);
  r.get('/loyalty/programs/:code', ({ params }) => {
    if (params.code !== db.loyaltyProgram.code) throw notFound(`Chương trình ${params.code}`);
    return programDto();
  });
  r.put('/loyalty/programs/:code', ({ params, body }) => {
    if (params.code !== db.loyaltyProgram.code) throw notFound(`Chương trình ${params.code}`);
    const rate = Number(body?.pointRateVnd);
    const errors: Record<string, string[]> = {};
    if (!(rate > 0)) errors.pointRateVnd = ['Phải là số lớn hơn 0.'];
    if (!String(body?.name ?? '').trim()) errors.name = ['Bắt buộc nhập.'];
    if (Object.keys(errors).length) throw validation(errors);
    const p = db.loyaltyProgram;
    Object.assign(p, { name: body.name, scope: body.scope ?? p.scope, validFrom: body.validFrom ?? p.validFrom, validTo: body.validTo ?? p.validTo, pointsExpireOn: body.pointsExpireOn ?? p.pointsExpireOn, status: body.status ?? p.status });
    db.settings.loyaltyPointRateVnd = rate;
    return programDto();
  });

  r.get('/loyalty/retailers', ({ query }) => paginate(db.retailers.map((x) => balanceRow(x.code)), query, (x) => `${x.retailerCode} ${x.retailerName}`));
  r.get('/loyalty/retailers/:code', ({ params }) => {
    const row = balanceRow(retailer(params.code).code);
    return {
      ...row, programCode: db.loyaltyProgram.code, programName: db.loyaltyProgram.name, pointsExpireOn: db.loyaltyProgram.pointsExpireOn,
      ledger: account(params.code).ledger, redemptions: db.redemptions.filter((x) => x.retailerCode === params.code).map(redemptionDto),
    };
  });

  r.get('/gifts', ({ query }) => paginate(db.gifts, query, (g) => `${g.code} ${g.name}`));
  r.post('/gifts', ({ body }) => {
    const errors: Record<string, string[]> = {};
    if (!String(body?.name ?? '').trim()) errors.name = ['Bắt buộc nhập.'];
    if (!(Number(body?.points) > 0)) errors.points = ['Phải lớn hơn 0.'];
    if (Number.isNaN(Number(body?.stock)) || body?.stock === '' || body?.stock === undefined) errors.stock = ['Phải là số.'];
    if (Object.keys(errors).length) throw validation(errors);
    const g: DbGift = { code: nextSeq(db.gifts.map((x) => x.code), 'QUA-', 3), name: body.name, points: Number(body.points), stock: Number(body.stock), redeemed: 0, status: body.status ?? 'Active' };
    db.gifts.push(g);
    return g;
  });
  r.put('/gifts/:code', ({ params, body }) => {
    const g = gift(params.code);
    if (body?.points !== undefined && !(Number(body.points) > 0)) throw validation({ points: ['Phải lớn hơn 0.'] });
    Object.assign(g, { name: body?.name ?? g.name, points: body?.points !== undefined ? Number(body.points) : g.points, stock: body?.stock !== undefined ? Number(body.stock) : g.stock, status: body?.status ?? g.status });
    return g;
  });

  r.get('/gift-redemptions', ({ query }) => paginate(db.redemptions.map(redemptionDto), query, (x) => `${x.code} ${x.retailerCode} ${retailer(x.retailerCode).name} ${x.giftCode} ${gift(x.giftCode).name}`));
  r.get('/gift-redemptions/:code', ({ params }) => redemptionDto(findRedemption(params.code)));
  r.post('/gift-redemptions', ({ body }) => {
    const g = gift(String(body?.giftCode ?? ''));
    const a = account(String(body?.retailerCode ?? ''));
    if (a.balance - heldOf(a.retailerCode) < g.points) throw validation({ giftCode: ['Điểm khả dụng không đủ.'] });
    const code = nextSeq(db.redemptions.map((x) => x.code).concat([`DQ-${yymmdd(MOCK_TODAY)}-00`]), `DQ-${yymmdd(MOCK_TODAY)}-`, 2);
    const x: DbRedemption = { code, retailerCode: a.retailerCode, giftCode: g.code, points: g.points, requestedAt: stamp(), status: 'Requested', handledNote: '' };
    db.redemptions.unshift(x);
    return redemptionDto(x);
  });
  const step = (to: DbRedemption['status'], from: DbRedemption['status'][], verb: string) => (req: Parameters<Parameters<MockRouter['post']>[1]>[0]) => {
    requireRole(req, ['Admin', 'Operator']);
    const x = findRedemption(req.params.code);
    if (!from.includes(x.status)) throw conflict(`Yêu cầu đang ${x.status}, không thể ${verb}.`);
    const g = gift(x.giftCode);
    const a = account(x.retailerCode);
    if (to === 'Approved') {
      if (g.stock < 1) throw conflict('Quà đã hết tồn kho.');
      a.balance -= x.points;
      a.ledger.unshift({ date: MOCK_TODAY, description: `Đổi quà ${g.code} ${g.name} · ${x.code}`, kind: 'Redeemed', points: -x.points });
      g.stock -= 1;
      g.redeemed += 1;
    }
    x.status = to;
    x.handledNote = `${stamp().slice(8, 10)}/${stamp().slice(5, 7)} ${stamp().slice(11)} · ${actor(req).name}`;
    return redemptionDto(x);
  };
  r.post('/gift-redemptions/:code/approve', step('Approved', ['Requested'], 'duyệt'));
  r.post('/gift-redemptions/:code/reject', step('Rejected', ['Requested'], 'từ chối'));
  r.post('/gift-redemptions/:code/deliver', step('Delivered', ['Approved'], 'giao quà'));
  r.post('/gift-redemptions/:code/complete', step('Done', ['Approved', 'Delivered'], 'hoàn tất'));
}
