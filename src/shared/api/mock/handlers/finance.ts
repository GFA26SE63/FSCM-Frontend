import { db } from '../fixtures';
import { MockRouter, conflict, notFound } from '../router';
import { actorLabel, orderById } from './common';
import { pricingOf, receivableOf } from './orderView';
import { MOCK_TODAY, stamp } from '../engines/clock';

export function registerFinance(r: MockRouter) {
  const refundDto = (x: (typeof db.refunds)[number]) => ({
    id: x.id, paymentId: `pay-${x.orderCode}`, salesOrderId: x.salesOrderId, orderCode: x.orderCode,
    amount: x.amount, recipient: x.recipient, reason: x.reason, status: x.status,
    transferredAt: x.transferredAt, transactionReference: x.transactionReference, evidenceReference: x.evidenceReference,
    createdByUserId: 'mock-admin', submittedByUserId: null, submittedAt: null, verifiedByUserId: null, verifiedAt: null,
    verificationNote: null, version: x.version, finalApprovedAmount: x.amount, adjustedAmount: x.amount,
    confirmedAmount: x.amount, pendingRefundAmount: x.status === 'PendingRefund' ? x.amount : 0,
    refundedAmount: x.status === 'Refunded' ? x.amount : 0, refundDueAmount: x.status === 'Refunded' ? 0 : x.amount,
    createdAt: x.createdAt, updatedAt: x.updatedAt,
  });

  r.get('/refunds', () => db.refunds.map(refundDto));
  r.post('/refunds', (req) => {
    const body = req.body ?? {};
    const row = { id: `rf-${String(db.refunds.length + 1).padStart(3, '0')}`, orderCode: String(body.salesOrderId), salesOrderId: String(body.salesOrderId), amount: Number(body.amount), recipient: String(body.recipient), reason: String(body.reason), status: 'PendingRefund' as const, transferredAt: null, transactionReference: null, evidenceReference: null, version: 1, createdAt: stamp(), updatedAt: stamp() };
    db.refunds.unshift(row);
    return refundDto(row);
  });
  r.post('/refunds/:id/evidence', (req) => {
    const row = db.refunds.find((x) => x.id === req.params.id);
    if (!row) throw notFound(`Nghĩa vụ hoàn ${req.params.id}`);
    if (row.status !== 'PendingRefund') throw conflict('Nghĩa vụ không còn chờ bằng chứng.');
    row.status = 'AwaitingVerification'; row.transferredAt = String(req.body?.transferredAt); row.transactionReference = String(req.body?.transactionReference); row.evidenceReference = String(req.body?.evidenceReference); row.version += 1; row.updatedAt = stamp();
    return refundDto(row);
  });
  r.post('/refunds/:id/verify', (req) => {
    const row = db.refunds.find((x) => x.id === req.params.id);
    if (!row) throw notFound(`Nghĩa vụ hoàn ${req.params.id}`);
    if (row.status !== 'AwaitingVerification') throw conflict('Nghĩa vụ chưa có bằng chứng để xác nhận.');
    row.status = 'Refunded'; row.version += 1; row.updatedAt = stamp();
    return refundDto(row);
  });

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
