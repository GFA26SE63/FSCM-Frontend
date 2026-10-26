import { useMemo, useState } from 'react';
import { Callout, Card, Chip, Input, PageHeader, QueryState, SimpleTable, Stat, type Tone } from '@/shared/ui';
import { formatNumber } from '@/shared/lib';
import { useRunByDate, useRunPickingLists } from '@/features/runpicking/hooks';
import type { RunPickingList } from '@/features/runpicking/types';
import { useOrdersReadiness } from '../hooks';
import { HAS_LEFT, type OrderShipmentReadiness, type ShipmentPartStatus, type ShipmentReadinessPart } from '../types';

const PART_STATUS: Record<ShipmentPartStatus, { tone: Tone; label: string }> = {
  WaitingToPick: { tone: 'info', label: 'Chưa soạn xong' },
  Ready: { tone: 'success', label: 'Sẵn sàng' },
  Issued: { tone: 'success', label: 'Đã xuất' },
  Delivering: { tone: 'warn', label: 'Đang giao' },
  Received: { tone: 'success', label: 'Đã nhận' },
  Exception: { tone: 'danger', label: 'Ngoại lệ' },
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * F93: which orders may leave the warehouses on a given run day, and what is holding the rest.
 *
 * The orders come from the run's picking sheets, because that is where the day's work is; the
 * verdict for each of them comes from the server, one order at a time. The screen never derives
 * readiness itself. An order draws from warehouses a single sheet knows nothing about and is gated
 * on a payment condition the Portal cannot see, so a verdict assembled here would eventually
 * disagree with the server — and disagreeing in the permissive direction means shipping half an
 * order.
 *
 * Two actions are deliberately absent. There is no "đưa vào đợt sau": an order that could not be
 * filled is history, and ordering again is a new order with a new place in the queue, never an
 * inherited one. And there is no way to issue a part from here — leaving the warehouse is confirmed
 * by the keeper who physically hands it over, on their own device.
 */
export function OrderReadinessPage() {
  const [businessDate, setBusinessDate] = useState(today());
  const runQuery = useRunByDate(businessDate);
  const listsQuery = useRunPickingLists(runQuery.data?.id);

  return (
    <>
      <PageHeader
        title="Sẵn sàng xuất & ngoại lệ"
        subtitle="Cả đơn phải soạn đủ ở mọi kho và đạt điều kiện thanh toán thì mới được xuất. Một kho thiếu hoặc hỏng là giữ cả đơn — không giao một phần."
        actions={<Input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />}
      />

      <QueryState query={runQuery}>
        {(run) => (
          <QueryState query={listsQuery}>
            {(lists) =>
              lists.length === 0 ? (
                <Callout tone="info">
                  Đợt {run.runCode} chưa phát hành phiếu soạn, nên chưa có đơn nào ở bước kiểm tra sẵn sàng.
                </Callout>
              ) : (
                <ReadinessBody runCode={run.runCode} lists={lists} />
              )
            }
          </QueryState>
        )}
      </QueryState>
    </>
  );
}

/** The distinct orders a run's sheets carry, each appearing once however many batches it drew. */
function ordersOf(lists: RunPickingList[]) {
  const byId = new Map<string, string>();
  for (const list of lists) {
    for (const gather of list.gathers) {
      for (const split of gather.splits) {
        if (!byId.has(split.salesOrderId)) byId.set(split.salesOrderId, split.orderCode);
      }
    }
  }
  return [...byId.entries()]
    .map(([salesOrderId, orderCode]) => ({ salesOrderId, orderCode }))
    .sort((a, b) => a.orderCode.localeCompare(b.orderCode));
}

function ReadinessBody({ runCode, lists }: { runCode: string; lists: RunPickingList[] }) {
  const orders = useMemo(() => ordersOf(lists), [lists]);
  const readiness = useOrdersReadiness(orders.map((order) => order.salesOrderId));

  const blocked = readiness.data.filter((item) => !item.isReady);
  const ready = readiness.data.filter((item) => item.isReady);

  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Stat label="Đợt" value={runCode} note={`${formatNumber(lists.length)} phiếu soạn`} />
        <Stat label="Đơn trong đợt" value={formatNumber(orders.length)} />
        <Stat label="Cần xử lý" value={formatNumber(blocked.length)} />
        <Stat label="Sẵn sàng xuất" value={formatNumber(ready.length)} />
      </div>

      {readiness.loading && <Callout tone="info">Đang lấy trạng thái sẵn sàng của từng đơn…</Callout>}
      {readiness.error && (
        <Callout tone="danger">
          Không lấy được trạng thái sẵn sàng của một hoặc nhiều đơn. Những đơn hiện bên dưới vẫn là
          dữ liệu thật; đơn thiếu thì chưa kết luận được, đừng coi là sẵn sàng.
        </Callout>
      )}

      {blocked.length > 0 && (
        <>
          <h3 style={{ margin: '14px 2px 8px', fontSize: 15 }}>Cần xử lý ({blocked.length})</h3>
          {blocked.map((item) => (
            <OrderCard key={item.salesOrderId} readiness={item} />
          ))}
        </>
      )}

      {ready.length > 0 && (
        <>
          <h3 style={{ margin: '18px 2px 8px', fontSize: 15 }}>Sẵn sàng xuất ({ready.length})</h3>
          {ready.map((item) => (
            <OrderCard key={item.salesOrderId} readiness={item} />
          ))}
        </>
      )}

      {!readiness.loading && readiness.data.length === 0 && (
        <Callout tone="info">Chưa đọc được trạng thái của đơn nào trong đợt này.</Callout>
      )}
    </>
  );
}

function OrderCard({ readiness }: { readiness: OrderShipmentReadiness }) {
  const columns = [
    { header: 'Kho', cell: (row: ShipmentReadinessPart) => <strong>{row.warehouseCode}</strong> },
    {
      header: 'Trạng thái',
      cell: (row: ShipmentReadinessPart) => {
        const status = PART_STATUS[row.status] ?? { tone: 'neutral' as Tone, label: row.status };
        return <Chip tone={status.tone}>{status.label}</Chip>;
      },
    },
    {
      header: 'Phiếu giao',
      cell: (row: ShipmentReadinessPart) =>
        row.shipmentCode ? (
          <span>{row.shipmentCode}</span>
        ) : (
          // No shipment record yet because that warehouse has not closed its sheet. Saying so is
          // the point: this is the warehouse the order is waiting on.
          <span className="muted small">chưa có — kho chưa đóng phiếu soạn</span>
        ),
    },
    {
      header: 'Ghi chú',
      cell: (row: ShipmentReadinessPart) => row.exceptionReason ?? <span className="muted">—</span>,
    },
  ];

  const anyLeft = readiness.parts.some((part) => HAS_LEFT.includes(part.status));

  return (
    <Card
      title={readiness.orderCode}
      actions={
        readiness.isReady ? (
          <Chip tone="success">Được xuất</Chip>
        ) : (
          <Chip tone={readiness.hasException ? 'danger' : 'warn'}>
            {readiness.hasException ? 'Ngoại lệ' : 'Đang bị giữ'}
          </Chip>
        )
      }
    >
      {readiness.blockingReasons.length > 0 && (
        <Callout tone={readiness.hasException ? 'danger' : 'warn'}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {readiness.blockingReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Callout>
      )}

      {!readiness.paymentSettled && (
        <Callout tone="warn">
          Đơn trả trước chưa thanh toán đủ. Đơn công nợ và COD không bị chặn ở cửa kho.
        </Callout>
      )}

      <SimpleTable columns={columns} rows={readiness.parts} empty="Đơn này chưa có phần hàng theo kho nào." />

      <p className="muted small" style={{ margin: '8px 2px 0' }}>
        {anyLeft
          ? 'Đã có phần hàng rời kho, nên không còn hủy được — phát sinh phải đi theo luồng khiếu nại.'
          : 'Chưa có phần nào rời kho, nên vẫn hủy được theo quyền; thao tác hủy kèm tác động tới tồn giữ và tiền đã thu nằm ở màn Hủy đơn.'}
      </p>
    </Card>
  );
}
