import { db } from '../fixtures';
import type { DbDriver, DbTransitTable, DbVehicle } from '../fixtures/types';

type MockTransitBand = DbTransitTable['bands'][number];
import { MockRouter, notFound, paginate, validation } from '../router';
import { warehouseName } from './common';
import { quoteTransit } from '../engines/transit';
import { whDistance } from '../engines/rotation';
import { MOCK_TODAY } from '../engines/clock';

const vehicleDto = (v: DbVehicle) => ({ ...v, warehouseName: warehouseName(v.warehouseCode) });
const trips = (match: (o: (typeof db.orders)[number]) => boolean) =>
  db.orders.filter((o) => o.delivery && match(o)).map((o) => ({ orderCode: o.code, retailerName: db.retailers.find((r) => r.code === o.retailerCode)?.name ?? o.retailerCode, departedAt: o.delivery!.departedAt, plate: o.delivery!.plate, driverName: o.delivery!.driverName, status: o.status }));
const findVehicle = (plate: string) => db.vehicles.find((v) => v.plate === plate) ?? (() => { throw notFound(`Xe ${plate}`); })();
const findDriver = (code: string) => db.drivers.find((d) => d.code === code) ?? (() => { throw notFound(`Người giao ${code}`); })();
const PLATE = /^\d{2}[A-Z]{1,2}-?\d{3}\.?\d{2}$/;
const PHONE = /^0\d{9}$/;

const currentTransitTable = () =>
  db.transitTables.find((t) => t.isActive) ?? db.transitTables[db.transitTables.length - 1];

/**
 * The allocation, rotation and order-view engines still read the km/day band shape, so keep it in
 * step with whichever table version is current.
 */
const syncLegacyBands = (table: DbTransitTable) => {
  db.transit = {
    validFrom: table.effectiveFrom.slice(0, 10),
    bands: table.bands.map((b) => ({
      fromKm: b.minDistanceMeters / 1000,
      toKm: b.maxDistanceMeters / 1000,
      days: Math.max(1, Math.ceil((b.handlingMinutes + b.transitMinutes) / 1440)),
      cost: b.estimatedCostAmount,
      scope: 'RetailerAndWarehouse' as const,
    })),
  };
};

export function registerLogistics(r: MockRouter) {
  // ---- shared transit table (F54): versioned, one table for every warehouse ----
  r.get('/transit-tables/current', () => currentTransitTable());
  r.get('/transit-tables/history', () => db.transitTables.slice().sort((a, b) => b.version - a.version));
  r.post('/transit-tables', ({ body }) => {
    const bands = (body?.bands ?? []) as MockTransitBand[];
    const serving = Number(body?.maxServingDistanceMeters);
    const effectiveFrom = String(body?.effectiveFrom ?? '');
    const current = currentTransitTable();
    const errors: Record<string, string[]> = {};
    if (!(serving > 0)) errors['maxServingDistanceMeters'] = ['Bán kính phục vụ phải lớn hơn 0.'];
    if (!effectiveFrom) errors['effectiveFrom'] = ['Thiếu ngày hiệu lực.'];
    else if (effectiveFrom <= current.effectiveFrom) errors['effectiveFrom'] = ['Ngày hiệu lực phải sau phiên bản hiện tại.'];
    if (bands.length === 0) errors['bands'] = ['Cần ít nhất một khoảng km.'];
    const ordered = bands.slice().sort((a, b) => a.minDistanceMeters - b.minDistanceMeters);
    ordered.forEach((b, i) => {
      if (b.maxDistanceMeters <= b.minDistanceMeters) errors[`bands${i}`] = ['Km kết thúc phải lớn hơn km bắt đầu.'];
      if (i === 0 && b.minDistanceMeters !== 0) errors['bands0'] = ['Khoảng đầu tiên phải bắt đầu từ 0.'];
      if (i > 0 && b.minDistanceMeters !== ordered[i - 1].maxDistanceMeters) errors[`bands${i}`] = ['Các khoảng phải nối liền nhau, không hở và không chồng.'];
    });
    if (Object.keys(errors).length) throw validation(errors);

    current.isActive = false;
    current.effectiveTo = effectiveFrom;
    const published = {
      id: `tt-${db.transitTables.length + 1}`,
      version: current.version + 1,
      maxServingDistanceMeters: serving,
      effectiveFrom,
      effectiveTo: null as string | null,
      isActive: true,
      note: (body?.note as string | null) ?? null,
      createdByUserId: 'mock-admin',
      createdAt: MOCK_TODAY,
      updatedAt: MOCK_TODAY,
      bands: ordered.map((b, i) => ({ ...b, id: `tt-${db.transitTables.length + 1}-b${i}` })),
    };
    db.transitTables.push(published);
    syncLegacyBands(published);
    return published;
  });
  r.get('/transit/quote', ({ query }) => {
    const purpose = query.purpose === 'warehouse' ? 'warehouse' : 'retailer';
    const km = purpose === 'warehouse' ? whDistance(db.whPairs, query.from, query.to) : db.retailerDist[query.to]?.[query.from] ?? 999;
    const q = quoteTransit(km, purpose, db.transit.bands, purpose === 'warehouse' ? db.settings.dmaxWarehouseKm : db.settings.dmaxRetailerKm);
    return { from: query.from, to: query.to, purpose, km, served: !!q, days: q?.days ?? null, cost: q?.cost ?? null };
  });

  // ---- system settings (allocation / rotation weights, Dmax, loyalty rate …) ----
  r.get('/settings', () => db.settings);
  r.put('/settings', ({ body }) => {
    const s = body as typeof db.settings;
    const sum = (o: { wE: number; wD: number; wQ: number }) => Number(o.wE) + Number(o.wD) + Number(o.wQ);
    const errors: Record<string, string[]> = {};
    if (Math.abs(sum(s.allocation) - 1) > 0.001) errors['allocation'] = [`Tổng trọng số phân bổ phải bằng 1 (đang ${sum(s.allocation).toFixed(2)}).`];
    if (Math.abs(sum(s.rotation) - 1) > 0.001) errors['rotation'] = [`Tổng trọng số luân chuyển phải bằng 1 (đang ${sum(s.rotation).toFixed(2)}).`];
    if (Number(s.dmaxRetailerKm) > Number(s.dmaxWarehouseKm)) errors['dmaxRetailerKm'] = ['Dmax_retailer không lớn hơn Dmax_kho.'];
    if (Object.keys(errors).length) throw validation(errors);
    db.settings = { ...db.settings, ...s };
    return db.settings;
  });

  // ---- vehicles & drivers (master data, no accounts) ----
  r.get('/vehicles', ({ query }) => paginate(db.vehicles.map(vehicleDto), query, (v) => `${v.plate} ${v.type} ${warehouseName(v.warehouseCode)}`));
  r.get('/vehicles/:plate', ({ params }) => ({ ...vehicleDto(findVehicle(params.plate)), recentTrips: trips((o) => o.delivery!.plate === params.plate) }));
  r.post('/vehicles', ({ body }) => {
    const plate = String(body?.plate ?? '').trim().toUpperCase();
    const errors: Record<string, string[]> = {};
    if (!PLATE.test(plate.replace(/\s/g, ''))) errors.plate = ['Biển số dạng 51C-482.17.']; else if (db.vehicles.some((v) => v.plate === plate)) errors.plate = ['Biển số đã tồn tại.'];
    if (!(Number(body?.capacity) > 0)) errors.capacity = ['Phải là số lớn hơn 0.'];
    if (Object.keys(errors).length) throw validation(errors);
    const v: DbVehicle = { plate, type: body?.type ?? 'Xe tải lạnh 1 tấn', capacity: Number(body?.capacity), warehouseCode: body?.warehouseCode ?? 'WH-TA', status: body?.status ?? 'Active' };
    db.vehicles.push(v);
    return vehicleDto(v);
  });
  r.put('/vehicles/:plate', ({ params, body }) => {
    const v = findVehicle(params.plate);
    if (body?.capacity !== undefined && !(Number(body.capacity) > 0)) throw validation({ capacity: ['Phải là số lớn hơn 0.'] });
    Object.assign(v, { type: body?.type ?? v.type, capacity: body?.capacity !== undefined ? Number(body.capacity) : v.capacity, warehouseCode: body?.warehouseCode ?? v.warehouseCode, status: body?.status ?? v.status });
    return vehicleDto(v);
  });

  r.get('/drivers', ({ query }) => paginate(db.drivers, query, (d) => `${d.code} ${d.name} ${d.phone}`));
  r.get('/drivers/:code', ({ params }) => ({ ...findDriver(params.code), recentTrips: trips((o) => o.delivery!.driverCode === params.code) }));
  r.post('/drivers', ({ body }) => {
    const errors: Record<string, string[]> = {};
    if (!String(body?.name ?? '').trim()) errors.name = ['Bắt buộc nhập.'];
    if (!PHONE.test(String(body?.phone ?? '').replace(/\s/g, ''))) errors.phone = ['Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.'];
    if (Object.keys(errors).length) throw validation(errors);
    const code = 'NG-' + String(Math.max(0, ...db.drivers.map((d) => Number(d.code.slice(3)))) + 1).padStart(3, '0');
    const d: DbDriver = { code, name: body.name, phone: body.phone, licenseClass: body.licenseClass ?? 'C', status: body.status ?? 'Active' };
    db.drivers.push(d);
    return d;
  });
  r.put('/drivers/:code', ({ params, body }) => {
    const d = findDriver(params.code);
    if (body?.phone && !PHONE.test(String(body.phone).replace(/\s/g, ''))) throw validation({ phone: ['Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.'] });
    Object.assign(d, { name: body?.name ?? d.name, phone: body?.phone ?? d.phone, licenseClass: body?.licenseClass ?? d.licenseClass, status: body?.status ?? d.status });
    return d;
  });
}
