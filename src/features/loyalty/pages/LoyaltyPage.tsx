import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DataTable, Fields, FormDialog, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib';
import { useBalances, useProgram, useUpdateProgram } from '../hooks';
import type { BalanceRow } from '../types';

export function LoyaltyPage() {
  const navigate = useNavigate();
  const program = useProgram();
  const balances = useBalances();
  const update = useUpdateProgram();
  const [edit, setEdit] = useState(false);
  const p = program.data;
  const columns: Column<BalanceRow>[] = [
    { key: 'code', header: 'Mã', width: '110px', render: (r) => <span className="bold">{r.retailerCode}</span> },
    { key: 'name', header: 'Retailer', text: (r) => r.retailerName },
    { key: 'balance', header: 'Số dư', width: '100px', align: 'right', text: (r) => formatNumber(r.balance) },
    { key: 'held', header: 'Đang giữ (chờ đổi quà)', width: '150px', align: 'right', text: (r) => formatNumber(r.held) },
    { key: 'avail', header: 'Khả dụng', width: '100px', align: 'right', text: (r) => formatNumber(r.available) },
    { key: 'pending', header: 'Đơn chờ cộng', width: '110px', align: 'right', text: (r) => r.pendingOrders },
    { key: 'last', header: 'Cộng gần nhất', width: '150px', text: (r) => (r.lastEarned ? `${formatDate(r.lastEarned.date)} · +${r.lastEarned.points}` : '—') },
  ];
  return (
    <>
      <PageHeader title="Loyalty – điểm" subtitle="Một chương trình điểm duy nhất, áp dụng cho mọi retailer. Điểm cộng sau khi đơn đã giao và đã thanh toán." />
      {p && (
        <Card title={`${p.code} · ${p.name}`} actions={<><StatusChip domain="loyaltyProgram" value={p.status} /><Button size="sm" onClick={() => setEdit(true)}>Sửa</Button></>}>
          <Fields cols={3} items={[
            { label: 'Phạm vi', value: p.scope },
            { label: 'Hiệu lực', value: `${formatDate(p.validFrom)} – ${formatDate(p.validTo)}` },
            { label: 'Điểm hết hạn', value: formatDate(p.pointsExpireOn) },
            { label: 'Quy đổi', value: `${formatMoney(p.pointRateVnd)} = 1 điểm` },
            { label: 'Quà đang áp dụng', value: `${p.gifts.length} quà` },
          ]} />
        </Card>
      )}
      <DataTable
        title="Số dư điểm theo retailer"
        rows={balances.data}
        loading={balances.isLoading}
        error={balances.error}
        rowKey={(r) => r.retailerCode}
        columns={columns}
        searchPlaceholder="Mã hoặc tên retailer…"
        onRowClick={(r) => navigate(`/loyalty/${r.retailerCode}`)}
        rowActionsWidth="90px"
        rowActions={(r) => <Button size="sm" onClick={() => navigate(`/loyalty/${r.retailerCode}`)}>Xem</Button>}
      />
      {p && (
        <FormDialog
          open={edit}
          width={680}
          title="Sửa chương trình loyalty"
          submitLabel="Lưu"
          initial={{ ...p }}
          fields={[
            { key: 'name', label: 'Tên chương trình', required: true, span: 2 },
            { key: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'Running', label: 'Đang chạy' }, { value: 'Paused', label: 'Tạm dừng' }] },
            { key: 'scope', label: 'Phạm vi', span: 2 },
            { key: 'pointRateVnd', label: 'Đồng / 1 điểm', type: 'number', required: true, validate: (v) => (Number(v) <= 0 ? 'Phải lớn hơn 0.' : undefined) },
            { key: 'validFrom', label: 'Hiệu lực từ', type: 'date' },
            { key: 'validTo', label: 'Hiệu lực đến', type: 'date' },
            { key: 'pointsExpireOn', label: 'Điểm hết hạn ngày', type: 'date' },
          ]}
          onClose={() => setEdit(false)}
          onSubmit={async (v) => {
            await update.mutateAsync({ code: p.code, name: v.name, scope: v.scope, validFrom: v.validFrom, validTo: v.validTo, pointsExpireOn: v.pointsExpireOn, status: v.status, pointRateVnd: Number(v.pointRateVnd) });
            setEdit(false);
          }}
        />
      )}
    </>
  );
}
