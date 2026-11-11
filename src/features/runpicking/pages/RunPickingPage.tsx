import { useState } from 'react';
import { useLocation, useNavigate } from '@/shared/router/compat';
import { Card, Chip, PageHeader, QueryState, Select, SimpleTable, Stat, type Tone } from '@/shared/ui';
import { formatCases, formatNumber, formatPercent } from '@/shared/lib';
import { formatDate, formatInstantDateTime } from '@/shared/lib/dates';
import { usePickingLists, useWarehouseOptions } from '../hooks';
import type { PickingItem, PickingList, PickingStatus } from '../types';

const STATUS: Record<PickingStatus, { tone: Tone; label: string }> = {
  Pending: { tone: 'info', label: 'Chờ soạn' },
  InProgress: { tone: 'warn', label: 'Đang soạn' },
  Completed: { tone: 'success', label: 'Đã soạn xong' },
  Exception: { tone: 'danger', label: 'Có ngoại lệ' },
};

export function RunPickingPage() {
  const requestedCode = new URLSearchParams(useLocation().search).get('code');
  const navigate = useNavigate();
  const [warehouseId, setWarehouseId] = useState('');
  const [status, setStatus] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const warehouses = useWarehouseOptions();
  const lists = usePickingLists(warehouseId, status);

  return (
    <>
      <PageHeader
        title="Phiếu soạn hàng"
        subtitle="Phiếu được tạo theo từng kho sau khi SO đủ điều kiện thành PO. Mỗi dòng giữ nguyên batch và giá đã chốt từ allocation."
        actions={requestedCode ? <button className="btn" onClick={() => navigate('/runpicking')}>Xem tất cả phiếu</button> : undefined}
      />
      <Card title="Bộ lọc">
        <div className="row-wrap" style={{ gap: 12 }}>
          <Select
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            placeholder="Tất cả kho"
            options={(warehouses.data ?? []).map((warehouse) => ({
              value: warehouse.id,
              label: `${warehouse.code} · ${warehouse.name}`,
            }))}
          />
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            placeholder="Tất cả trạng thái"
            options={Object.entries(STATUS).map(([code, meta]) => ({ value: code, label: meta.label }))}
          />
        </div>
      </Card>

      <QueryState query={lists}>
        {(allRows) => {
          const rows = requestedCode ? allRows.filter(row => row.pickingCode === requestedCode) : allRows;
          return (
          <>
            <div className="stats-grid" style={{ marginBottom: 12 }}>
              <Stat label="Tổng phiếu" value={formatNumber(rows.length)} />
              <Stat label="Đang soạn" value={formatNumber(rows.filter((row) => row.status === 'InProgress').length)} />
              <Stat label="Đã xong" value={formatNumber(rows.filter((row) => row.status === 'Completed').length)} />
              <Stat label="Ngoại lệ" value={formatNumber(rows.filter((row) => row.status === 'Exception').length)} />
            </div>
            {rows.map((list) => (
              <PickingCard
                key={list.id}
                list={list}
                open={openId === list.id || openId === null && requestedCode === list.pickingCode}
                onToggle={() => setOpenId(openId === list.id || openId === null && requestedCode === list.pickingCode ? '' : list.id)}
              />
            ))}
            {rows.length === 0 && <Card>Không có phiếu soạn phù hợp bộ lọc.</Card>}
          </>
          );
        }}
      </QueryState>
    </>
  );
}

function PickingCard({ list, open, onToggle }: { list: PickingList; open: boolean; onToggle: () => void }) {
  const required = list.items.reduce((sum, item) => sum + item.requestedQuantity, 0);
  const picked = list.items.reduce((sum, item) => sum + item.pickedQuantity, 0);
  const meta = STATUS[list.status] ?? { tone: 'neutral' as Tone, label: list.status };
  const columns = [
    { header: 'SKU / sản phẩm', cell: (item: PickingItem) => <><strong>{item.sku}</strong><br /><span className="muted small">{item.productName}</span></> },
    { header: 'Batch / HSD', cell: (item: PickingItem) => <><strong>{item.batchCode}</strong><br /><span className="muted small">{formatDate(item.expirationDate)}</span></> },
    { header: 'Cần soạn', align: 'right' as const, cell: (item: PickingItem) => formatCases(item.requestedQuantity) },
    { header: 'Đã soạn', align: 'right' as const, cell: (item: PickingItem) => formatCases(item.pickedQuantity) },
    { header: 'Còn lại', align: 'right' as const, cell: (item: PickingItem) => formatCases(item.remainingQuantity) },
    { header: 'Trạng thái', cell: (item: PickingItem) => item.status },
  ];
  return (
    <Card
      title={`${list.pickingCode} · ${list.warehouseName || list.warehouseCode}`}
      actions={<button type="button" className="btn btn-sm" onClick={onToggle}>{open ? 'Thu gọn' : 'Xem chi tiết'}</button>}
    >
      <div className="row-wrap" style={{ gap: 20, alignItems: 'center' }}>
        <Chip tone={meta.tone}>{meta.label}</Chip>
        <span>Đơn <strong>{list.orderCode}</strong> · {list.retailerCode} {list.retailerName}</span>
        <span>Tiến độ <strong>{formatCases(picked)}</strong> / {formatCases(required)} {required > 0 && `(${formatPercent(picked / required * 100, 1)})`}</span>
        {list.startedAt && <span>Bắt đầu {formatInstantDateTime(list.startedAt)}</span>}
        {list.confirmedAt && <span>Hoàn tất {formatInstantDateTime(list.confirmedAt)}</span>}
      </div>
      {open && <SimpleTable columns={columns} rows={list.items} empty="Phiếu chưa có dòng hàng." />}
    </Card>
  );
}
