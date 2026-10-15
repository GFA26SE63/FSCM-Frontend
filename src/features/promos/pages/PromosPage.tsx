import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatDate, statusLabels } from '@/shared/lib';
import { useActivatePromo, usePausePromo, usePromos } from '../hooks';
import type { PromoSummary } from '../types';

export function PromosPage() {
  const navigate = useNavigate();
  const query = usePromos();
  const pause = usePausePromo();
  const activate = useActivatePromo();
  const columns: Column<PromoSummary>[] = [
    { key: 'code', header: 'Mã', width: '90px', render: (p) => <span className="bold">{p.code}</span> },
    { key: 'name', header: 'Tên chương trình' },
    { key: 'type', header: 'Loại', width: '150px', text: (p) => (p.type === 'PerSku' ? 'Theo từng SKU' : 'Nhóm sản phẩm') },
    { key: 'period', header: 'Hiệu lực', width: '170px', text: (p) => `${formatDate(p.validFrom)} – ${formatDate(p.validTo)}` },
    { key: 'sku', header: 'Số SKU', width: '80px', align: 'right', text: (p) => p.skuCount },
    { key: 'cust', header: 'Khách hàng', width: '120px', text: (p) => (p.customerCount == null ? 'Tất cả' : `${p.customerCount} retailer`) },
    { key: 'status', header: 'Trạng thái', width: '125px', render: (p) => <StatusChip domain="promotion" value={p.status} /> },
  ];
  return (
    <>
      <PageHeader title="Khuyến mãi" subtitle="Mỗi dòng hàng được áp dụng một khuyến mãi tốt nhất; không cộng dồn." />
      <DataTable
        title="Chương trình khuyến mãi"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(p) => p.code}
        columns={columns}
        searchPlaceholder="Mã, tên chương trình…"
        filters={[
          { label: 'Trạng thái', options: Object.values(statusLabels.promotion), value: (p) => statusLabels.promotion[p.status] },
          { label: 'Loại', options: ['Theo từng SKU', 'Nhóm sản phẩm'], value: (p) => (p.type === 'PerSku' ? 'Theo từng SKU' : 'Nhóm sản phẩm') },
        ]}
        actions={<Button variant="primary" onClick={() => navigate('/promos/new')}>+ Tạo khuyến mãi</Button>}
        onRowClick={(p) => navigate(`/promos/${p.code}`)}
        rowActionsWidth="190px"
        rowActions={(p) => (
          <>
            <Button size="sm" onClick={() => navigate(`/promos/${p.code}`)}>Xem</Button>
            {p.status === 'Running' && <Button size="sm" variant="danger" onClick={() => pause.mutate(p.code)}>Tạm dừng</Button>}
            {p.status === 'Paused' && <Button size="sm" variant="primary" onClick={() => activate.mutate(p.code)}>Kích hoạt</Button>}
          </>
        )}
      />
    </>
  );
}
