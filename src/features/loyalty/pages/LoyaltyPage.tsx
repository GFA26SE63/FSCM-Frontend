import { useCurrentTime } from '@/shared/hooks';
import { useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { assertPermission, can } from '@/shared/auth/permissions';
import { useNavigate } from '@/shared/router/compat';
import { Button, Card, DataTable, Fields, FormDialog, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatDate, formatMoney, formatNumber, formatInstantDate, vietnamDate } from '@/shared/lib';
import { useBalances, useProgram, useUpdateProgram } from '../hooks';
import type { BalanceRow } from '../types';

export function LoyaltyPage() {
  const now = useCurrentTime();
  const { user } = useAuth();
  const mayManage = can(user, 'loyalty.manage');
  const navigate = useNavigate();
  const program = useProgram();
  const balances = useBalances();
  const update = useUpdateProgram();
  const [edit, setEdit] = useState(false);
  const p = program.data;
  const rate = p?.spendAmountPerPoint ?? p?.pointRateVnd ?? 0;
  const startAt = p?.startAt ?? p?.validFrom ?? '';
  const endAt = p?.endAt ?? p?.validTo ?? '';
  const expiry = p?.pointsExpireAt ?? p?.pointsExpireOn ?? '';
  const active = p?.isActive ?? p?.status === 'Running';
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
        <Card title={`${p.code} · ${p.name}`} actions={<><StatusChip domain="loyaltyProgram" value={active ? 'Running' : 'Paused'} />{mayManage && <Button size="sm" onClick={() => setEdit(true)}>Sửa</Button>}</>}>
          <Fields cols={3} items={[
            { label: 'Retailer áp dụng', value: p.retailerIds?.length ? `${p.retailerIds.length} retailer` : (p.scope ?? '—') },
            { label: 'Hiệu lực', value: `${formatInstantDate(startAt)} – ${formatInstantDate(endAt)}` },
            { label: 'Điểm hết hạn', value: expiry ? formatInstantDate(expiry) : 'Không đặt' },
            { label: 'Quy đổi', value: `${formatMoney(rate)} = 1 điểm` },
            { label: 'Điểm tối thiểu đổi quà', value: formatNumber(p.minimumRedeemPoints ?? 0) },
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
      {p && mayManage && (
        <FormDialog
          open={edit}
          width={680}
          title="Sửa chương trình loyalty"
          submitLabel="Lưu"
          initial={{
            name: p.name, description: p.description ?? '', spendAmountPerPoint: rate,
            minimumRedeemPoints: p.minimumRedeemPoints ?? 0, startAt: vietnamDate(startAt),
            endAt: vietnamDate(endAt), pointsExpireAt: expiry ? vietnamDate(expiry) : '',
            retailerIdsText: (p.retailerIds ?? []).join(', '),
          }}
          fields={[
            { key: 'name', label: 'Tên chương trình', required: true, span: 2 },
            { key: 'description', label: 'Mô tả', type: 'textarea', span: 2 },
            { key: 'spendAmountPerPoint', label: 'Đồng / 1 điểm', type: 'number', required: true, validate: (v) => (!Number.isFinite(Number(v)) || Number(v) <= 0 ? 'Phải là số lớn hơn 0.' : undefined) },
            { key: 'minimumRedeemPoints', label: 'Điểm tối thiểu đổi quà', type: 'number', required: true, validate: (v) => (!Number.isInteger(Number(v)) || Number(v) < 0 || Number(v) > 2147483647 ? 'Phải là số nguyên không âm.' : undefined) },
            { key: 'startAt', label: 'Hiệu lực từ', type: 'date', required: true, readOnly: new Date(startAt).getTime() <= now, validate: (v) => String(v) !== vietnamDate(startAt) && String(v) < vietnamDate() ? 'Không được trước hôm nay (giờ Việt Nam).' : undefined },
            { key: 'endAt', label: 'Hiệu lực đến', type: 'date', required: true, validate: (v, values) => String(v) < String(values.startAt) || String(v) < vietnamDate() ? 'Ngày kết thúc phải từ hôm nay và không trước ngày bắt đầu.' : undefined },
            { key: 'pointsExpireAt', label: 'Điểm hết hạn ngày', type: 'date', validate: (v, values) => String(v) < String(values.endAt) ? 'Điểm hết hạn không được trước ngày kết thúc chương trình.' : undefined },
            { key: 'retailerIdsText', label: 'Retailer áp dụng (UUID, phân tách bằng dấu phẩy)', type: 'textarea', required: true, span: 2 },
          ]}
          onClose={() => setEdit(false)}
          onSubmit={async (v) => {
            assertPermission(user, 'loyalty.manage');
            await update.mutateAsync({ id: p.id ?? p.code, name: v.name, description: v.description || null,
              spendAmountPerPoint: Number(v.spendAmountPerPoint), minimumRedeemPoints: Number(v.minimumRedeemPoints),
              startAt: String(v.startAt) === vietnamDate(startAt) ? startAt : new Date(`${v.startAt}T00:00:00+07:00`).toISOString(), endAt: String(v.endAt) === vietnamDate(endAt) ? endAt : new Date(`${v.endAt}T23:59:59.999+07:00`).toISOString(),
              pointsExpireAt: v.pointsExpireAt ? (expiry && String(v.pointsExpireAt) === vietnamDate(expiry) ? expiry : new Date(`${v.pointsExpireAt}T23:59:59.999+07:00`).toISOString()) : null,
              retailerIds: String(v.retailerIdsText).split(',').map((x) => x.trim()).filter(Boolean) });
            setEdit(false);
          }}
        />
      )}
    </>
  );
}
