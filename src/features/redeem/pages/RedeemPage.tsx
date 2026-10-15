import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatDateTime, formatNumber, statusLabel, statusLabels } from '@/shared/lib';
import { useRedemptions } from '../hooks';
import { RedeemActions } from '../components/RedeemActions';
import type { Redemption } from '../types';

export function RedeemPage() {
  const navigate = useNavigate();
  const query = useRedemptions();
  const columns: Column<Redemption>[] = [
    { key: 'code', header: 'Mã yêu cầu', width: '130px', render: (x) => <span className="bold">{x.code}</span> },
    { key: 'retailer', header: 'Retailer', text: (x) => `${x.retailerName} ${x.retailerCode}`, render: (x) => (<><div className="strong">{x.retailerName}</div><div className="muted small">{x.retailerCode}</div></>) },
    { key: 'gift', header: 'Quà', text: (x) => `${x.giftCode} ${x.giftName}` },
    { key: 'points', header: 'Điểm', width: '90px', align: 'right', text: (x) => formatNumber(x.points) },
    { key: 'avail', header: 'Điểm khả dụng', width: '120px', align: 'right', text: (x) => formatNumber(x.available) },
    { key: 'at', header: 'Ngày yêu cầu', width: '140px', text: (x) => formatDateTime(x.requestedAt) },
    { key: 'status', header: 'Trạng thái', width: '130px', render: (x) => <StatusChip domain="gift" value={x.status} /> },
  ];
  return (
    <>
      <PageHeader title="Yêu cầu đổi quà" subtitle="Retailer gửi yêu cầu từ app; điểm bị giữ cho đến khi Admin / Operator duyệt hoặc từ chối." />
      <DataTable
        title="Yêu cầu đổi quà"
        rows={query.data}
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
