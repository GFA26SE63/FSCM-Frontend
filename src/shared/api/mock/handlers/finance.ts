import { db } from '../fixtures';
import { MockRouter, conflict, notFound } from '../router';
import { actorLabel, orderById } from './common';
import { pricingOf, receivableOf } from './orderView';
import { MOCK_TODAY, stamp } from '../engines/clock';

export function registerFinance(r: MockRouter) {
  r.get('/receivables', ({ query }) => {
    let rows = db.orders.map(receivableOf).filter((x): x is NonNullable<typeof x> => !!x);
    if (query.status) rows = rows.filter((x) => x.status === query.status);
    if (query.retailerCode) rows = rows.filter((x) => x.retailerCode === query.retailerCode);
    return rows;
  });

  /** Single full collection – no partial payments, no credit limit (SPEC §4 Finance). */
  r.post('/payments/orders/:orderId/collect', (req) => {
    const o = orderById(req.params.orderId);
    const rec = receivableOf(o);
    if (!rec) throw notFound(`Công nợ của đơn ${o.code}`);
    if (rec.status === 'Paid') throw conflict('Công nợ đã thu đủ.');
    const method = req.body?.collectionMethod === 'BankTransfer' ? 'Transfer' : 'Cash';
    const by = method === 'Cash' ? `Sales ${o.salesName} – tiền mặt` : `${actorLabel(req)} – chuyển khoản`;
    o.credit = { ...o.credit!, paid: true, paidAt: stamp(), collectedBy: by, method };
    o.paidNote = 'Đã thanh toán (công nợ)';
    o.timeline.push({ at: stamp(), label: `Ghi nhận đã thu đủ ${rec.outstandingAmount.toLocaleString('vi-VN')}đ (${by}) – cộng điểm loyalty` });
    const acc = db.loyalty.find((a) => a.retailerCode === o.retailerCode);
    const pts = Math.floor(pricingOf(o).final / db.settings.loyaltyPointRateVnd);
    if (acc) {
      acc.ledger = acc.ledger.filter((e) => !(e.kind === 'Pending' && e.description.startsWith(o.code)));
      acc.ledger.unshift({ date: MOCK_TODAY, description: `${o.code} · công nợ đã thanh toán`, kind: 'Earned', points: pts });
      acc.balance += pts;
    }
    return receivableOf(o);
  });
}
