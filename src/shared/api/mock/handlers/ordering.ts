import { db } from '../fixtures';
import type { DbOrder } from '../fixtures/types';
import { MockRouter, businessRule, conflict, notFound, paginate, validation } from '../router';
import { actor, actorLabel, nextSeq, order, requireRole, retailer } from './common';
import { orderDetail, orderSummary, pickingLists, pricingOf, traceOf } from './orderView';
import { MOCK_TODAY, stamp } from '../engines/clock';
import { addDays } from '../../../lib/dates';

const push = (o: DbOrder, label: string) => o.timeline.push({ at: stamp(), label });
const byCode = (code: string) => pickingLists().find((p) => p.code === code) ?? (() => { throw notFound(`Picking list ${code}`); })();

function loyaltyAfterDelivery(o: DbOrder) {
  const acc = db.loyalty.find((a) => a.retailerCode === o.retailerCode);
  if (!acc) return;
  const pts = Math.floor(pricingOf(o).final / db.settings.loyaltyPointRateVnd);
  if (o.paymentMethod === 'Credit') acc.ledger.unshift({ date: MOCK_TODAY, description: `${o.code} · công nợ, cộng khi đã thanh toán`, kind: 'Pending', points: null });
  else {
    acc.ledger.unshift({ date: MOCK_TODAY, description: `${o.code} · đã giao, đã thanh toán`, kind: 'Earned', points: pts });
    acc.balance += pts;
  }
}

export function registerOrdering(r: MockRouter) {
  // ---- orders ----
  r.get('/orders', ({ query }) => {
    let rows = db.orders.map(orderSummary);
    if (query.status) rows = rows.filter((o) => o.status === query.status);
    return paginate(rows, query, (o) => `${o.code} ${o.retailerCode} ${o.retailerName} ${o.itemsSummary} ${o.salesName}`);
  });
  r.post('/orders/sync', ({ body }) => {
    // Offline orders from the mobile app: processed in arrival order, idempotent by clientRequestId (SPEC §4 Ordering).
    const incoming = (body?.orders ?? []) as { clientRequestId: string; retailerCode: string; lines: { sku: string; qty: number }[]; salesName?: string; paymentMethod?: DbOrder['paymentMethod']; createdAt?: string }[];
    return {
      results: incoming.map((i) => {
        const dup = db.orders.find((o) => (o as DbOrder & { clientRequestId?: string }).clientRequestId === i.clientRequestId);
        if (dup) return { clientRequestId: i.clientRequestId, code: dup.code, status: dup.status };
        const code = nextSeq(db.orders.map((x) => x.code), 'DH-', 6);
        retailer(i.retailerCode);
        const o: DbOrder & { clientRequestId?: string } = {
          code, retailerCode: i.retailerCode, lines: i.lines, status: 'Pending', createdAt: i.createdAt ?? stamp(), salesName: i.salesName ?? 'Nguyễn Văn An', channel: 'Offline', syncedAt: stamp(), syncMode: 'Tự động',
          promoChanged: false, localDiscount: 0, paymentMethod: i.paymentMethod ?? 'COD', prepaidChannel: null, termDays: null, paidNote: 'Chưa thanh toán', reason: '', reviewer: '',
          promoIds: db.promotions.filter((p) => p.status === 'Running').map((p) => p.code), heldBefore: {}, delivery: null, credit: null, archived: false, timeline: [], clientRequestId: i.clientRequestId,
        };
        db.orders.unshift(o);
        if (!traceOf(o).ok) { o.status = 'Rejected'; o.reason = 'Không đủ hàng khả dụng hợp lệ.'; push(o, 'Hệ thống tự động từ chối – không đủ hàng'); }
        else push(o, 'Đồng bộ đơn offline – phân bổ B1–B4, tạm giữ hàng – chờ duyệt');
        return { clientRequestId: i.clientRequestId, code, status: o.status };
      }),
    };
  });
  r.get('/orders/:code', ({ params }) => orderDetail(order(params.code)));

  r.get('/orders/:code/allocation-trace', ({ params }) => {
    const o = order(params.code);
    const trace = traceOf(o);
    const s = db.settings;
    const dispatched = ['Shipped', 'Delivering', 'Delivered', 'Completed'].includes(o.status);
    return {
      orderCode: o.code, retailerCode: o.retailerCode, retailerName: retailer(o.retailerCode).name,
      basis: `Tính trên tồn khả dụng tại thời điểm xử lý đơn (${o.channel === 'Offline' && o.syncedAt ? 'lúc đồng bộ ' + o.syncedAt.replace('T', ' ') : o.createdAt.replace('T', ' ')})`,
      dispatchDate: '2026-09-28', dmaxRetailerKm: s.dmaxRetailerKm, weights: s.allocation, ok: trace.ok, dispatched,
      lines: trace.lines, estimatedDeliveryCost: trace.ok ? orderDetail(o).estimatedDeliveryCost : null,
    };
  });

  r.post('/orders/:code/approve', (req) => {
    requireRole(req, ['Admin', 'Operator']);
    const o = order(req.params.code);
    if (o.status !== 'Pending') throw conflict(`Đơn ${o.code} đang ${o.status}, không duyệt được.`);
    if (!traceOf(o).ok) throw businessRule('Đơn không đủ hàng hợp lệ – không thể duyệt.');
    o.status = 'Approved';
    o.reviewer = actorLabel(req);
    const n = new Set(traceOf(o).lines.flatMap((l) => l.allocations.map((a) => a.warehouseCode))).size;
    push(o, `${actor(req).role} duyệt đơn – sinh ${n} picking list theo kho, hàng tạm giữ chuyển Reserved`);
    return orderDetail(o);
  });
  r.post('/orders/:code/reject', (req) => {
    requireRole(req, ['Admin', 'Operator']);
    const o = order(req.params.code);
    const reason = String(req.body?.reason ?? '').trim();
    if (!reason) throw validation({ reason: ['Bắt buộc nhập lý do.'] });
    if (o.status !== 'Pending') throw conflict(`Đơn ${o.code} đang ${o.status}, không từ chối được.`);
    o.status = 'Rejected';
    o.reason = reason;
    push(o, `${actor(req).role} từ chối: ${reason} – trả lại hàng tạm giữ`);
    return orderDetail(o);
  });
  r.post('/orders/:code/cancel', (req) => {
    requireRole(req, ['Admin', 'Operator']);
    const o = order(req.params.code);
    const reason = String(req.body?.reason ?? '').trim();
    if (!reason) throw validation({ reason: ['Bắt buộc nhập lý do.'] });
    if (!['Pending', 'Approved'].includes(o.status)) throw conflict('Chỉ hủy được đơn Chờ duyệt / Đã duyệt (chưa xuất kho).');
    o.status = 'Cancelled';
    o.reason = reason;
    push(o, `${actor(req).role} hủy đơn: ${reason} – trả lại hàng tạm giữ / Reserved`);
    return orderDetail(o);
  });
  r.post('/orders/:code/dispatch', (req) => {
    requireRole(req, ['Admin', 'Operator']);
    const o = order(req.params.code);
    if (o.status !== 'Shipped') throw conflict('Chỉ cập nhật Đang giao cho đơn Đã xuất kho.');
    const v = db.vehicles.find((x) => x.plate === req.body?.plate);
    const d = db.drivers.find((x) => x.code === req.body?.driverCode);
    const errors: Record<string, string[]> = {};
    if (!v || v.status !== 'Active') errors.plate = ['Chọn xe đang hoạt động.'];
    if (!d || d.status !== 'Active') errors.driverCode = ['Chọn người giao đang hoạt động.'];
    const qty = o.lines.reduce((a, l) => a + l.qty, 0);
    if (v && qty > v.capacity) errors.plate = [`Xe ${v.plate} chỉ chở ${v.capacity} thùng – đơn ${qty} thùng. Chọn xe khác.`];
    if (Object.keys(errors).length) throw validation(errors);
    o.delivery = { plate: v!.plate, vehicleType: v!.type, driverCode: d!.code, driverName: d!.name, driverPhone: d!.phone, departedAt: stamp() };
    o.status = 'Delivering';
    push(o, `Operator cập nhật Đang giao – xe ${v!.plate}, người giao ${d!.code} ${d!.name}`);
    return orderDetail(o);
  });
  r.post('/orders/:code/confirm-receipt', (req) => {
    const o = order(req.params.code);
    if (o.status !== 'Delivering') throw conflict('Đơn chưa ở trạng thái Đang giao.');
    o.status = 'Delivered';
    if (o.paymentMethod === 'Credit') {
      const term = o.termDays ?? 14;
      const due = addDays(MOCK_TODAY, term);
      o.credit = { termDays: term, deliveredAt: stamp(), dueDate: due, paid: false, paidAt: null, collectedBy: null, method: null };
      push(o, `Retailer quét QR xác nhận đã nhận – ghi nợ, hạn trả ${due.split('-').reverse().join('/')}`);
    } else push(o, 'Retailer quét QR xác nhận đã nhận');
    loyaltyAfterDelivery(o);
    return orderDetail(o);
  });

  // ---- picking lists (Warehouse Keeper) ----
  r.get('/picking-lists', ({ query }) => paginate(pickingLists(), query, (p) => `${p.code} ${p.orderCode} ${p.warehouseName}`));
  r.get('/picking-lists/:code', ({ params }) => byCode(params.code));
  r.post('/picking-lists/:code/scan', (req) => {
    const p = byCode(req.params.code);
    if (p.status === 'Shipped') throw conflict('Picking list đã xuất.');
    db.pickStatus[p.code] = 'Picking';
    const o = order(p.orderCode);
    if (o.status === 'Approved') { o.status = 'Picking'; push(o, 'Warehouse Keeper bắt đầu soạn hàng – quét tem batch'); }
    return byCode(p.code);
  });
  r.post('/picking-lists/:code/ship', (req) => {
    const p = byCode(req.params.code);
    if (p.status === 'Shipped') throw conflict('Picking list đã xuất.');
    db.pickStatus[p.code] = 'Shipped';
    const o = order(p.orderCode);
    const rest = pickingLists().filter((x) => x.orderCode === o.code && x.code !== p.code && x.status !== 'Shipped');
    if (!rest.length) { o.status = 'Shipped'; push(o, 'Warehouse Keeper xác nhận xuất đủ các picking list – trừ tồn thực tế'); }
    return { picking: byCode(p.code), remainingLists: rest.length, orderStatus: o.status };
  });

  // ---- complaints ----
  const complaintDto = (c: (typeof db.complaints)[number]) => ({ ...c, retailerName: retailer(c.retailerCode).name });
  r.get('/complaints', ({ query }) => paginate(db.complaints.map(complaintDto), query, (c) => `${c.code} ${c.orderCode} ${retailer(c.retailerCode).name} ${c.content}`));
  r.get('/complaints/:code', ({ params }) => complaintDto(db.complaints.find((c) => c.code === params.code) ?? (() => { throw notFound(`Khiếu nại ${params.code}`); })()));
  r.post('/complaints/:code/resolve', ({ params, body }) => {
    const c = db.complaints.find((x) => x.code === params.code) ?? (() => { throw notFound(`Khiếu nại ${params.code}`); })();
    if (c.status === 'Resolved') throw conflict('Khiếu nại đã xử lý.');
    c.status = 'Resolved';
    c.result = String(body?.result ?? '').trim() || 'Đã xử lý và báo retailer';
    return complaintDto(c);
  });
}
