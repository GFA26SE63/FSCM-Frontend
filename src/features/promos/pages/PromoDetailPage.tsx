import { useParams } from '@/shared/router/compat';
import { Button, Callout, Card, DataTable, Fields, PageHeader, QueryState, StatusChip, type Column } from '@/shared/ui';
import { formatInstantDate, formatNumber, formatPercent, statusLabel } from '@/shared/lib';
import { useActivatePromo, usePausePromo, usePromo, usePromoTargets } from '../hooks';
import { promoStatus } from '../status';
import type { ProductOption, RetailerOption } from '../types';

export function PromoDetailPage() {
  const { id = '' } = useParams();
  const query = usePromo(id);
  const { products, categories, retailers } = usePromoTargets(query.data);
  const pause = usePausePromo();
  const activate = useActivatePromo();

  const productColumns: Column<ProductOption>[] = [
    { key: 'sku', header: 'Mã SKU', width: '150px' },
    { key: 'name', header: 'Tên sản phẩm', width: '260px' },
    { key: 'categoryName', header: 'Nhóm hàng', width: '180px', text: p => p.categoryName || p.categoryCode || '—' },
    { key: 'unit', header: 'Đơn vị tính', width: '110px', text: p => p.unit || '—' },
    { key: 'status', header: 'Trạng thái', width: '130px', text: p => statusLabel('product', p.status) },
  ];
  const retailerColumns: Column<RetailerOption>[] = [
    { key: 'code', header: 'Mã cửa hàng', width: '150px' },
    { key: 'name', header: 'Tên cửa hàng', width: '230px' },
    { key: 'contactName', header: 'Người liên hệ', width: '170px', text: r => r.contactName || '—' },
    { key: 'phone', header: 'Số điện thoại', width: '140px', text: r => r.phone || '—' },
    { key: 'email', header: 'Email', width: '220px', text: r => r.email || '—' },
    { key: 'address', header: 'Địa chỉ', width: '260px', text: r => r.address || '—' },
    { key: 'salesGroupCode', header: 'Nhóm Sales', width: '130px', text: r => r.salesGroupCode || '—' },
    { key: 'creditTermDays', header: 'Hạn công nợ', width: '130px', text: r => r.creditTermDays == null ? '—' : r.creditTermDays > 0 ? `${r.creditTermDays} ngày` : 'Trả trước' },
    { key: 'status', header: 'Trạng thái', width: '140px', text: r => statusLabel('active', r.status) },
  ];

  return (
    <QueryState query={query}>
      {(p) => {
        const status = promoStatus(p);
        // Older API responses store per-SKU campaigns as individual single-product promotions.
        // Their threshold is safe to show on that SKU without guessing the original campaign mode.
        const singleSkuScope = !p.campaignMode && p.productIds.length === 1 && p.categoryIds.length === 0;
        const perSku = p.campaignMode === 'PerSku' || singleSkuScope;
        const rules = new Map((p.productRules ?? []).map(rule => [rule.productId, rule]));
        const appliedProductColumns: Column<ProductOption>[] = perSku ? [...productColumns,
          { key: 'minimumQuantity', header: 'Tối thiểu (thùng)', width: '150px', align: 'right',
            text: product => formatNumber(rules.get(product.id)?.minimumQuantity ?? p.minimumQuantity) },
          { key: 'discountPercent', header: '% giảm', width: '110px', align: 'right',
            text: product => formatPercent(rules.get(product.id)?.discountPercent ?? p.discountPercent, 2) },
        ] : productColumns;
        return (
          <>
            <PageHeader
              back="/promos"
              title={p.name}
              subtitle={`${p.campaignMode === 'PerSku' ? 'Loại 1 · Điều kiện riêng từng SKU' : singleSkuScope ? 'Điều kiện theo SKU' : 'Loại 2 · Cộng số lượng trong nhóm'} · ${formatInstantDate(p.startAt)} – ${formatInstantDate(p.endAt)}`}
              chips={<StatusChip domain="promotion" value={status} />}
              actions={
                <>
                  {(status === 'Running' || status === 'Scheduled') && <Button variant="danger" loading={pause.isPending} onClick={() => pause.mutate(p.id)}>Tạm dừng</Button>}
                  {status === 'Paused' && <Button variant="primary" loading={activate.isPending} onClick={() => activate.mutate(p.id)}>Kích hoạt lại</Button>}
                </>
              }
            />
            {!p.isActive && status !== 'Ended' && <Callout tone="info">Chương trình đã được lưu và đang tạm dừng. Chọn “Kích hoạt lại” để áp dụng cho đơn mới.</Callout>}
            <Card title="Thông tin chương trình"><Fields cols={3} items={[
              { label: 'Mã chương trình', value: p.code },
              { label: 'Tên chương trình', value: p.name },
              { label: 'Hiệu lực từ', value: formatInstantDate(p.startAt) },
              { label: 'Hiệu lực đến', value: formatInstantDate(p.endAt) },
              { label: 'Ngày tạo', value: formatInstantDate(p.createdAt) },
              { label: 'Cập nhật gần nhất', value: formatInstantDate(p.updatedAt) },
            ]} /></Card>
            {!perSku && <Card title="Loại 2 · Điều kiện chung của nhóm">
              <Fields items={[
                { label: 'Tổng số lượng tối thiểu của nhóm', value: `${p.minimumQuantity} thùng` },
                { label: '% giảm', value: formatPercent(p.discountPercent, 1) },
                { label: 'Loại', value: 'Loại 2 · Theo nhóm sản phẩm' },
              ]} />
            </Card>}
            <Card title={perSku ? 'SKU áp dụng · điều kiện từng sản phẩm' : 'SKU áp dụng'}
              actions={<Button size="sm" loading={products.isFetching} onClick={() => void products.refetch()}>Tải lại sản phẩm</Button>}>
              <DataTable key={p.id} urlState={false} title={`Danh sách SKU · ${products.data?.length ?? new Set([...p.productIds, ...rules.keys()]).size}`}
                columns={appliedProductColumns} rows={products.error ? undefined : products.data} loading={products.isLoading} error={products.error}
                rowKey={product => product.id} pageSize={5} searchPlaceholder="Tìm mã SKU, tên sản phẩm hoặc nhóm hàng…"
                emptyText={p.categoryIds.length ? 'Phạm vi SKU được xác định theo các nhóm hàng áp dụng bên dưới.' : 'Chương trình chưa có sản phẩm áp dụng.'} />
            </Card>
            {!!p.categoryIds.length && <Card title="Nhóm hàng áp dụng"
              actions={<Button size="sm" loading={categories.isFetching} onClick={() => void categories.refetch()}>Tải lại nhóm hàng</Button>}>
              <DataTable key={p.id} urlState={false} columns={[
                { key: 'code', header: 'Mã nhóm hàng' }, { key: 'name', header: 'Tên nhóm hàng' },
              ]} rows={categories.error ? undefined : categories.data} loading={categories.isLoading} error={categories.error}
                rowKey={category => category.id} pageSize={5} searchPlaceholder="Tìm mã hoặc tên nhóm hàng…" />
            </Card>}
            <Card title="Khách hàng được hưởng ưu đãi"
              actions={<Button size="sm" loading={retailers.isFetching} onClick={() => void retailers.refetch()}>Tải lại khách hàng</Button>}>
              {!p.retailerIds.length && <Callout tone="info">Áp dụng cho tất cả cửa hàng đủ điều kiện. Bảng hiển thị các cửa hàng đang hoạt động hiện tại.</Callout>}
              <DataTable key={p.id} urlState={false} title={p.retailerIds.length ? `Cửa hàng đã chọn · ${p.retailerIds.length}` : `Cửa hàng đang hoạt động · ${retailers.data?.length ?? '…'}`}
                columns={retailerColumns} rows={retailers.error ? undefined : retailers.data} loading={retailers.isLoading} error={retailers.error}
                rowKey={retailer => retailer.id} pageSize={5} searchPlaceholder="Tìm mã, tên, liên hệ, số điện thoại hoặc địa chỉ cửa hàng…"
                emptyText={p.retailerIds.length ? 'Không có dữ liệu khách hàng áp dụng.' : 'Chưa có cửa hàng đang hoạt động.'} />
            </Card>
          </>
        );
      }}
    </QueryState>
  );
}
