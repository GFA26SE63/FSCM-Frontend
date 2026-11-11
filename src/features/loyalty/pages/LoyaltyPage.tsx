import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, PageHeader, type Column } from '@/shared/ui';
import { formatDate, formatNumber } from '@/shared/lib';
import { useBalances } from '../hooks';
import { LoyaltyProgramsPanel } from '../components/LoyaltyProgramsPanel';
import type { BalanceRow } from '../types';

export function LoyaltyPage() {
  const navigate = useNavigate();
  const balances = useBalances();
  const columns: Column<BalanceRow>[] = [
    { key: 'code', header: 'Mã', width: '110px', render: (r) => <span className="bold">{r.retailerCode}</span> },
    { key: 'name', header: 'Retailer', text: (r) => r.retailerName },
    { key: 'balance', header: 'Số dư', width: '100px', align: 'right', text: (r) => formatNumber(r.balance) },
    { key: 'held', header: 'Đang giữ (chờ đổi quà)', width: '150px', align: 'right', text: (r) => formatNumber(r.held) },
    { key: 'avail', header: 'Khả dụng', width: '100px', align: 'right', text: (r) => formatNumber(r.available) },
    { key: 'pending', header: 'Điểm chờ cộng', width: '110px', align: 'right', text: (r) => r.pendingOrders },
    { key: 'last', header: 'Cộng gần nhất', width: '150px', text: (r) => (r.lastEarned ? `${formatDate(r.lastEarned.date)} · +${r.lastEarned.points}` : '—') },
  ];
  return (
    <>
      <PageHeader title="Loyalty – điểm"
        subtitle="Quản lý chương trình và số dư điểm. Điểm được cộng khi đơn Completed và đáp ứng điều kiện chương trình." />
      <LoyaltyProgramsPanel />
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
    </>
  );
}
