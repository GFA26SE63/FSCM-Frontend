import { useState } from 'react';
import { Callout, Card, Chip, Input, PageHeader, QueryState, SimpleTable, Stat, type Tone } from '@/shared/ui';
import { formatCases, formatNumber, formatPercent } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { useRole } from '@/shared/auth/AuthContext';
import { useRunByDate, useRunPickingLists, useWarehouseOptions } from '../hooks';
import type { RunPickingGather, RunPickingList, RunPickingSplit } from '../types';

const LIST_STATUS: Record<string, { tone: Tone; label: string }> = {
  Issued: { tone: 'info', label: 'Đã phát hành' },
  Picking: { tone: 'warn', label: 'Đang soạn' },
  Completed: { tone: 'success', label: 'Soạn xong' },
  Exception: { tone: 'danger', label: 'Ngoại lệ' },
};

/** The run sheet has its own two states; the old per-order picking vocabulary does not apply. */
const GATHER_STATUS: Record<string, string> = {
  Pending: 'Chưa lấy',
  Picked: 'Đã lấy',
};

const today = () => new Date().toISOString().slice(0, 10);

/** Short, readable stand-in for an identifier the screen must carry but nobody reads in full. */
const shortRef = (id: string) => id.slice(0, 8);

/**
 * F43: the warehouse picking sheet for one run.
 *
 * Gather first, split second, which is the order the work happens in: one trip per batch collects
 * everything the run needs from it, then the split rows say which order each unit belongs to.
 *
 * Two things the screen must not do, and so does not offer. It never merges two batches of one SKU
 * into a single row — the batch a unit came from is what the allocation and its price were decided
 * on, and losing it would make the sheet unverifiable. And it never computes money: each split
 * carries the identifier of the price record the run approved, and that reference is what is shown.
 * A number worked out here could differ from the one on the invoice the moment a discount table
 * changed, and nobody would notice until a reconciliation.
 */
export function RunPickingPage() {
  const [businessDate, setBusinessDate] = useState(today());
  const role = useRole();
  const runQuery = useRunByDate(businessDate);
  const listsQuery = useRunPickingLists(runQuery.data?.id);
  const warehouses = useWarehouseOptions();
  const [openId, setOpenId] = useState<string | null>(null);

  const warehouseLabel = (id: string) => {
    const found = warehouses.data?.find((item) => item.id === id);
    return found ? `${found.code} · ${found.name}` : shortRef(id);
  };

  // Price figures belong to the roles that handle money; a keeper picking cartons does not need
  // them on the shelf, and the sheet is not where a price is decided anyway.
  const maySeePrice = role === 'Admin' || role === 'Operator';

  return (
    <>
      <PageHeader
        title="Phiếu soạn theo đợt"
        subtitle="Phát hành sau khi phương án được duyệt và giữ tồn xong. Lấy gom theo batch, rồi chia về từng dòng đơn — phiếu soạn không tính lại giá."
        actions={<Input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />}
      />

      <QueryState query={runQuery}>
        {(run) => (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <Stat label="Đợt" value={run.runCode} note={`Chốt ${formatInstantDateTime(run.cutoffAt)}`} />
              <Stat label="Trạng thái đợt" value={run.status} />
              <Stat label="Số phiếu soạn" value={formatNumber(listsQuery.data?.length ?? 0)} />
            </div>

            <QueryState query={listsQuery}>
              {(lists) =>
                lists.length === 0 ? (
                  <Callout tone="info">
                    Đợt này chưa phát hành phiếu soạn. Phiếu chỉ được phát hành sau khi Admin duyệt phương án và
                    hệ thống giữ tồn thành công.
                  </Callout>
                ) : (
                  <>
                    {lists.map((list) => (
                      <PickingListCard
                        key={list.id}
                        list={list}
                        warehouseLabel={warehouseLabel(list.warehouseId)}
                        open={openId === list.id}
                        onToggle={() => setOpenId(openId === list.id ? null : list.id)}
                        maySeePrice={maySeePrice}
                      />
                    ))}
                  </>
                )
              }
            </QueryState>
          </>
        )}
      </QueryState>
    </>
  );
}

function PickingListCard({
  list,
  warehouseLabel,
  open,
  onToggle,
  maySeePrice,
}: {
  list: RunPickingList;
  warehouseLabel: string;
  open: boolean;
  onToggle: () => void;
  maySeePrice: boolean;
}) {
  const required = list.gathers.reduce((sum, item) => sum + item.requiredQuantity, 0);
  const picked = list.gathers.reduce((sum, item) => sum + item.pickedQuantity, 0);
  const status = LIST_STATUS[list.status] ?? { tone: 'neutral' as Tone, label: list.status };

  return (
    <Card
      title={`${list.pickingCode} · ${warehouseLabel}`}
      actions={
        <button type="button" className="btn btn-sm" onClick={onToggle}>
          {open ? 'Thu gọn' : 'Xem chi tiết'}
        </button>
      }
    >
      <div className="row-wrap" style={{ gap: 20, alignItems: 'center', fontSize: 13.5 }}>
        <Chip tone={status.tone}>{status.label}</Chip>
        <span>
          Tiến độ: <strong>{formatCases(picked)}</strong> / {formatCases(required)}
          {required > 0 && <> ({formatPercent((picked / required) * 100, 1)})</>}
        </span>
        <span>Phát hành {formatInstantDateTime(list.issuedAt)}</span>
        {list.completedAt && <span>Xong {formatInstantDateTime(list.completedAt)}</span>}
      </div>

      {list.exceptionType && (
        <Callout tone="danger">
          Ngoại lệ ({list.exceptionType}): {list.exceptionNote ?? 'chưa ghi chú'}. Một kho có ngoại lệ thì cả đơn
          phải xử lý trước khi bất kỳ phần nào được xuất.
        </Callout>
      )}

      {open && (
        <div className="stack">
          {list.gathers.map((gather) => (
            <GatherSection key={gather.id} gather={gather} maySeePrice={maySeePrice} />
          ))}
        </div>
      )}
    </Card>
  );
}

function GatherSection({ gather, maySeePrice }: { gather: RunPickingGather; maySeePrice: boolean }) {
  const splitColumns = [
    { header: 'Đơn', cell: (row: RunPickingSplit) => <strong>{row.orderCode}</strong> },
    { header: 'Chia về', align: 'right' as const, cell: (row: RunPickingSplit) => formatCases(row.quantity) },
    { header: 'Đã soạn', align: 'right' as const, cell: (row: RunPickingSplit) => formatCases(row.pickedQuantity) },
    ...(maySeePrice
      ? [
          {
            header: 'Bản giá đã duyệt',
            cell: (row: RunPickingSplit) => (
              <span className="muted small" title={row.allocationPlanPriceId}>
                {shortRef(row.allocationPlanPriceId)}
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <div
        className="card"
        style={{ padding: '10px 14px', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}
      >
        <span>
          SKU <strong>{gather.sku}</strong>
        </span>
        {/* The batch stays on screen: it is what the allocation and its price were decided on. */}
        <span>
          Batch <strong>{gather.batchCode}</strong>
        </span>
        <span>
          Cần lấy <strong>{formatCases(gather.requiredQuantity)}</strong>
        </span>
        <span>
          Đã lấy <strong>{formatCases(gather.pickedQuantity)}</strong>
        </span>
        <Chip tone={gather.status === 'Picked' ? 'success' : 'neutral'}>
          {GATHER_STATUS[gather.status] ?? gather.status}
        </Chip>
      </div>
      <SimpleTable
        columns={splitColumns}
        rows={gather.splits}
        empty="Lượt lấy này chưa chia về đơn nào."
      />
    </div>
  );
}
