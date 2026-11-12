import { useLocation, useNavigate } from '@/shared/router/compat';
import { useState } from 'react';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatNumber, statusLabel, statusLabels } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { useRedemptions } from '../hooks';
import { RedeemActions } from '../components/RedeemActions';
import type { Redemption } from '../types';

export function RedeemPage() {
  const navigate = useNavigate();
  const query = useRedemptions();
  const [openedAt] = useState(() => Date.now());
  const params = new URLSearchParams(useLocation().search);
  const status = params.get('status');
  const aged = params.get('aged') === 'true';
  const regionId = params.get('regionId');
  const salesGroupId = params.get('salesGroupId');
  const filteredRows = query.data?.filter(x => (!status || x.status === (status === 'Pending' ? 'Requested' : status === 'Completed' ? 'Done' : status)) &&
    (!regionId || x.regionId === regionId) && (!salesGroupId || x.salesGroupIds?.includes(salesGroupId)) &&
    (!aged || ['Requested', 'Approved', 'Delivered'].includes(x.status) && Date.parse(x.updatedAt) < openedAt - 3 * 86400000));
  const columns: Column<Redemption>[] = [
    { key: 'code', header: 'Mã yêu cầu', width: '130px', render: (x) => <span className="bold">{x.code}</span> },
    { key: 'retailer', header: 'Retailer', text: (x) => `${x.retailerName} ${x.retailerCode}`, render: (x) => (<><div className="strong">{x.retailerName}</div><div className="muted small">{x.retailerCode}</div></>) },
    { key: 'gift', header: 'Quà', text: (x) => `${x.giftCode} ${x.giftName}` },
    { key: 'quantity', header: 'Số lượng', align: 'right', text: (x) => x.quantity == null ? '—' : formatNumber(x.quantity) },
    { key: 'points', header: 'Điểm', width: '90px', align: 'right', text: (x) => formatNumber(x.points) },
    { key: 'avail', header: 'Điểm khả dụng', width: '120px', align: 'right', text: (x) => formatNumber(x.available) },
    { key: 'at', header: 'Ngày yêu cầu', width: '140px', text: (x) => formatInstantDateTime(x.requestedAt) },
    { key: 'status', header: 'Trạng thái', width: '130px', render: (x) => <StatusChip domain="gift" value={x.status} /> },
  ];
  return (
    <>
      <PageHeader title="Yêu cầu đổi quà" subtitle="Điểm được giữ đến khi hoàn tất hoặc từ chối yêu cầu."
        actions={<><Button onClick={() => navigate('/reports?kind=redemptions')}>Báo cáo đổi quà</Button>{(status || aged || regionId || salesGroupId) && <Button onClick={() => navigate('/redeem')}>Bỏ lọc dashboard</Button>}</>} />
      <DataTable
        title="Yêu cầu đổi quà"
        rows={filteredRows}
        loading={query.isLoading}
        error={query.error}
        rowKey={(x) => x.code}
        columns={columns}
        searchPlaceholder="Mã yêu cầu, retailer, quà…"
        filters={[{ label: 'Trạng thái', options: Object.values(statusLabels.gift), value: (x) => statusLabel('gift', x.status) }]}
        onRowClick={(x) => navigate(`/redeem/${x.code}`)}
        rowActionsWidth="240px"
        rowActions={(x) => (
          <>
            <Button size="sm" onClick={() => navigate(`/redeem/${x.code}`)}>Xem</Button>
            <RedeemActions x={x} />
          </>
        )}
      />
    </>
  );
}
