import { db } from '../fixtures';
import type { DbRegistration, DbRetailer } from '../fixtures/types';
import { MockRouter, businessRule, notFound, paginate, validation } from '../router';
import { areaName, nextSeq, product, requireRole } from './common';
import { mlorOf } from './orderView';
import { stamp } from '../engines/clock';

const potential = (fc: number, cap: number): 'A' | 'B' | 'C' => (fc >= 60_000_000 || cap >= 120 ? 'A' : fc >= 30_000_000 || cap >= 60 ? 'B' : 'C');

const retailerDto = (r: DbRetailer) => ({ ...r, areaName: areaName(r.areaCode) });
const regDto = (x: DbRegistration) => ({ ...x, areaName: areaName(x.areaCode), potentialClass: potential(x.forecastRevenue, x.monthlyCapacity) });
const find = (code: string) => db.retailers.find((r) => r.code === code) ?? (() => { throw notFound(`Retailer ${code}`); })();
const findReg = (code: string) => db.registrations.find((r) => r.code === code) ?? (() => { throw notFound(`Khai báo ${code}`); })();

function readRetailer(body: Record<string, unknown>, existing?: DbRetailer) {
  const errors: Record<string, string[]> = {};
  const str = (k: string, label = 'Bắt buộc nhập.') => { const v = String(body[k] ?? '').trim(); if (!v) errors[k] = [label]; return v; };
  const num = (k: string) => { const n = Number(body[k]); if (body[k] === undefined || body[k] === '' || Number.isNaN(n)) { errors[k] = ['Phải là số.']; return 0; } return n; };
  const code = existing ? existing.code : str('code');
  if (!existing && code && !/^\d{8}$/.test(code)) errors.code = ['Mã gồm đúng 8 chữ số.'];
  if (!existing && db.retailers.some((r) => r.code === code)) errors.code = ['Mã đã tồn tại.'];
  const phone = str('phone');
  if (phone && !/^0\d{9}$/.test(phone.replace(/\s/g, ''))) errors.phone = ['Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.'];
  const out = {
    code, name: str('name'), address: str('address'), phone, contact: String(body.contact ?? ''), areaCode: String(body.areaCode ?? 'Q12'), groupCode: String(body.groupCode ?? 'Q12-A'),
    lat: num('lat'), lng: num('lng'), kind: String(body.kind ?? 'Tạp hóa'), size: (body.size as 'S' | 'M' | 'L') ?? 'M', areaM2: Number(body.areaM2) || 0, fridges: Number(body.fridges) || 0,
    forecastRevenue: num('forecastRevenue'), monthlyCapacity: num('monthlyCapacity'), orderFrequency: String(body.orderFrequency ?? '1 lần/tuần'),
    creditTermDays: ([0, 7, 14, 30].includes(Number(body.creditTermDays)) ? Number(body.creditTermDays) : 0) as 0 | 7 | 14 | 30, status: (body.status as 'Active' | 'Locked') ?? 'Active',
  };
  if (Object.keys(errors).length) throw validation(errors);
  return { ...out, potentialClass: potential(out.forecastRevenue, out.monthlyCapacity) };
}

export function registerPartners(r: MockRouter) {
  r.get('/areas', ({ query }) => paginate(db.areas.map((a) => ({ ...a, groups: db.groups.filter((g) => g.areaCode === a.code).map((g) => g.code), retailerCount: db.retailers.filter((x) => x.areaCode === a.code).length })), query));
  r.post('/areas', ({ body }) => {
    const code = String(body?.code ?? '').trim().toUpperCase();
    const name = String(body?.name ?? '').trim();
    const errors: Record<string, string[]> = {};
    if (!code) errors.code = ['Bắt buộc nhập.']; else if (db.areas.some((a) => a.code === code)) errors.code = ['Mã đã tồn tại.'];
    if (!name) errors.name = ['Bắt buộc nhập.']; else if (db.areas.some((a) => a.name === name)) errors.name = ['Tên đã tồn tại.'];
    if (Object.keys(errors).length) throw validation(errors);
    const a = { code, name, region: body?.region ?? 'Miền Nam', managerName: body?.managerName ?? 'Hồ Gia Bảo', wards: body?.wards ?? [] };
    db.areas.push(a);
    return a;
  });

  const groupDto = (g: (typeof db.groups)[number]) => ({
    ...g, areaName: areaName(g.areaCode), retailerCount: db.retailers.filter((x) => x.groupCode === g.code).length,
    memberRows: g.members.map((m) => { const k = db.kpi.find((x) => x.name === m); return { name: m, groupCode: g.code, revenueAfterPromo: k?.after ?? 0, revenueBeforePromo: k?.before ?? 0 }; }),
  });
  r.get('/sales-groups', ({ query }) => paginate(db.groups.map(groupDto), query));
  r.get('/sales-groups/:code', ({ params }) => groupDto(db.groups.find((g) => g.code === params.code) ?? (() => { throw notFound(`Nhóm ${params.code}`); })()));
  const saveGroup = (code: string, body: Record<string, unknown>, create: boolean) => {
    const members = (body.members as string[]) ?? [];
    if (create) {
      if (!code) throw validation({ code: ['Bắt buộc nhập.'] });
      if (db.groups.some((g) => g.code === code)) throw validation({ code: ['Mã đã tồn tại.'] });
    }
    if (!members.length) throw validation({ members: ['Chọn ít nhất một Sales.'] });
    // a Sales belongs to ONE group – moving them here removes them from the old one
    db.groups.forEach((g) => { if (g.code !== code) g.members = g.members.filter((m) => !members.includes(m)); });
    let g = db.groups.find((x) => x.code === code);
    if (!g) { g = { code, areaCode: String(body.areaCode ?? 'Q12'), managerName: String(body.managerName ?? 'Hồ Gia Bảo'), members }; db.groups.push(g); }
    else Object.assign(g, { areaCode: body.areaCode ?? g.areaCode, managerName: body.managerName ?? g.managerName, members });
    return groupDto(g);
  };
  r.post('/sales-groups', ({ body }) => saveGroup(String(body?.code ?? '').trim().toUpperCase(), body ?? {}, true));
  r.put('/sales-groups/:code', ({ params, body }) => saveGroup(params.code, body ?? {}, false));
  r.get('/sales-staff', () => db.salesStaff.map((name) => ({ name, groupCode: db.groups.find((g) => g.members.includes(name))?.code ?? null })));
  r.post('/sales-staff/transfer', ({ body }) => {
    const { name, toGroup } = body ?? {};
    const from = db.groups.find((g) => g.members.includes(name));
    const to = db.groups.find((g) => g.code === toGroup);
    if (!to) throw validation({ toGroup: ['Chọn nhóm đích.'] });
    if (from?.code === to.code) throw validation({ toGroup: ['Nhóm đích phải khác nhóm hiện tại.'] });
    if (from) from.members = from.members.filter((m) => m !== name);
    to.members.push(name);
    return { name, fromGroup: from?.code ?? null, toGroup: to.code, effectiveDate: body?.effectiveDate ?? null };
  });

  r.get('/retailers', ({ query }) => paginate(db.retailers.map(retailerDto), query, (x) => `${x.code} ${x.name} ${x.address} ${x.areaCode}`));
  r.get('/retailers/:code', ({ params }) => retailerDto(find(params.code)));
  r.post('/retailers', ({ body }) => {
    const x = readRetailer(body ?? {});
    const row: DbRetailer = { ...x, source: 'Admin tạo trên Portal' };
    db.retailers.push(row);
    db.retailerDist[row.code] = Object.fromEntries(db.warehouses.map((w) => [w.code, 12 + (Number(row.code) % 30)]));
    db.loyalty.push({ retailerCode: row.code, balance: 0, ledger: [] });
    return retailerDto(row);
  });
  r.put('/retailers/:code', ({ params, body }) => {
    const row = find(params.code);
    Object.assign(row, readRetailer(body ?? {}, row));
    return retailerDto(row);
  });
  r.get('/retailers/:code/mlor', ({ params }) => {
    find(params.code);
    return db.products.filter((p) => p.status !== 'Draft').map((p) => ({ sku: p.sku, productName: p.name, shelfLifeDays: p.shelfLifeDays, defaultMlor: p.defaultMlor, mlor: mlorOf(params.code, p.sku), overridden: db.retailerMlor[params.code]?.[p.sku] != null }));
  });
  r.put('/retailers/:code/mlor', ({ params, body }) => {
    find(params.code);
    const items = (body?.items ?? []) as { sku: string; mlor: number }[];
    items.forEach((i) => {
      product(i.sku);
      if (!(i.mlor > 0 && i.mlor < 1)) throw validation({ mlor: ['m phải nằm trong (0, 1).'] });
      (db.retailerMlor[params.code] ??= {})[i.sku] = i.mlor;
    });
    return undefined;
  });

  r.get('/retailer-registrations', ({ query }) => paginate(db.registrations.map(regDto), query, (x) => `${x.code} ${x.name} ${x.address}`));
  r.get('/retailer-registrations/:code', ({ params }) => regDto(findReg(params.code)));
  r.post('/retailer-registrations/:code/approve', (req) => {
    requireRole(req, ['Admin', 'Operator']);
    const reg = findReg(req.params.code);
    if (reg.status !== 'Pending') throw businessRule('Khai báo đã được xử lý.');
    const code = String(Math.max(10004300, ...db.retailers.map((x) => Number(x.code))) + 1);
    const group = db.groups.find((g) => g.members.includes(reg.salesName));
    const row: DbRetailer = {
      code, name: reg.name, address: reg.address, phone: reg.phone, contact: reg.contact, areaCode: reg.areaCode, groupCode: group?.code ?? 'Q12-A', lat: 10.87, lng: 106.65, status: 'Active',
      source: `Sales ${reg.salesName} khai báo`, kind: reg.kind, size: reg.size, areaM2: 0, fridges: 0, forecastRevenue: reg.forecastRevenue, monthlyCapacity: reg.monthlyCapacity,
      orderFrequency: '1 lần/tuần', potentialClass: potential(reg.forecastRevenue, reg.monthlyCapacity), creditTermDays: 0,
    };
    db.retailers.push(row);
    db.retailerDist[code] = Object.fromEntries(db.warehouses.map((w) => [w.code, 8 + (Number(code) % 25)]));
    db.loyalty.push({ retailerCode: code, balance: 0, ledger: [] });
    reg.status = 'Approved';
    reg.retailerCode = code;
    db.notifications.unshift({ id: 'N-' + nextSeq(db.notifications.map((n) => n.id), 'N-', 3).slice(2), title: 'Khai báo retailer đã duyệt', body: `${reg.code} → mã điểm bán ${code}.`, createdAt: stamp(), read: false, link: '/retailers' });
    return { registration: regDto(reg), retailer: retailerDto(row) };
  });
  r.post('/retailer-registrations/:code/reject', (req) => {
    requireRole(req, ['Admin', 'Operator']);
    const reg = findReg(req.params.code);
    if (reg.status !== 'Pending') throw businessRule('Khai báo đã được xử lý.');
    reg.status = 'Rejected';
    reg.rejectReason = String(req.body?.reason ?? '');
    return regDto(reg);
  });
}
