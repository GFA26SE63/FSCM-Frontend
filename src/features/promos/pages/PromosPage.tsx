import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatInstantDate, formatPercent, statusLabels } from '@/shared/lib';
import { useActivatePromo, usePausePromo, usePromos } from '../hooks';
import { promoStatus } from '../status';
import type { PromoSummary } from '../types';

export function PromosPage() {
  const navigate = useNavigate();
  const query = usePromos();
  const pause = usePausePromo();
  const activate = useActivatePromo();
  const columns: Column<PromoSummary>[] = [
    { key: 'code', header: 'Mã', width: '110px', render: (p) => <span className="bold">{p.code}</span> },
    { key: 'name', header: 'Tên chương trình' },
    { key: 'type', header: 'Loại', text: (p) => p.campaignMode === 'PerSku' ? 'Loại 1 · Từng SKU' : 'Loại 2 · Nhóm SKU' },
    { key: 'min', header: 'Mua tối thiểu', width: '130px', align: 'right', text: (p) => p.campaignMode === 'PerSku' ? 'Theo từng SKU' : `${p.minimumQuantity} thùng / nhóm` },
    { key: 'pct', header: '% giảm', width: '90px', align: 'right', text: (p) => p.campaignMode === 'PerSku' ? 'Theo từng SKU' : formatPercent(p.discountPercent, 1) },
    { key: 'period', header: 'Hiệu lực', width: '180px', text: (p) => `${formatInstantDate(p.startAt)} – ${formatInstantDate(p.endAt)}` },
    { key: 'status', header: 'Trạng thái', width: '125px', render: (p) => <StatusChip domain="promotion" value={promoStatus(p)} /> },
  ];
  return (
    <>
      <PageHeader
        title="Khuyến mãi"
        subtitle="Loại 1 đặt ngưỡng và % giảm riêng từng SKU. Loại 2 cộng lượng của nhóm SKU trong cùng đơn. Mỗi dòng nhận khuyến mãi đủ điều kiện tốt nhất."
      />
      <DataTable
        title="Chương trình khuyến mãi"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(p) => p.id}
        columns={columns}
        searchPlaceholder="Mã, tên chương trình…"
        filters={[
          { label: 'Trạng thái', options: Object.values(statusLabels.promotion), value: (p) => statusLabels.promotion[promoStatus(p)] },
        ]}
        actions={<Button variant="primary" onClick={() => navigate('/promos/new')}>+ Tạo khuyến mãi</Button>}
        onRowClick={(p) => navigate(`/promos/${p.id}`)}
        rowActionsWidth="190px"
        rowActions={(p) => (
          <>
            <Button size="sm" onClick={() => navigate(`/promos/${p.id}`)}>Xem</Button>
            {(promoStatus(p) === 'Running' || promoStatus(p) === 'Scheduled') && <Button size="sm" variant="danger" onClick={() => pause.mutate(p.id)}>Tạm dừng</Button>}
            {promoStatus(p) === 'Paused' && <Button size="sm" variant="primary" onClick={() => activate.mutate(p.id)}>Kích hoạt</Button>}
          </>
        )}
      />
    </>
  );
}
