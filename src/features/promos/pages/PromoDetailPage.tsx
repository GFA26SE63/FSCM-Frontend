import { useParams } from '@/shared/router/compat';
import { Button, Callout, Card, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { formatInstantDate, formatPercent } from '@/shared/lib';
import { useActivatePromo, usePausePromo, usePromo, usePromoLookups } from '../hooks';
import { promoStatus } from '../status';

export function PromoDetailPage() {
  const { id = '' } = useParams();
  const query = usePromo(id);
  const { products, categories, retailers } = usePromoLookups();
  const pause = usePausePromo();
  const activate = useActivatePromo();

  const namesOf = <T extends { id: string }>(data: T[] | undefined, ids: string[], label: (item: T) => string) => {
    if (ids.length === 0) return null;
    return ids.map((x) => { const found = data?.find((item) => item.id === x); return found ? label(found) : x; }).join(', ');
  };

  return (
    <QueryState query={query}>
      {(p) => {
        const status = promoStatus(p);
        return (
          <>
            <PageHeader
              back="/promos"
              title={p.name}
              subtitle={`${p.campaignMode === "PerSku" ? "Loại 1 · Điều kiện riêng từng SKU" : "Loại 2 · Cộng số lượng trong nhóm"} · ${formatInstantDate(p.startAt)} – ${formatInstantDate(p.endAt)}`}
              chips={<StatusChip domain="promotion" value={status} />}
              actions={
                <>
                  {(status === 'Running' || status === 'Scheduled') && <Button variant="danger" loading={pause.isPending} onClick={() => pause.mutate(p.id)}>Tạm dừng</Button>}
                  {status === 'Paused' && <Button variant="primary" loading={activate.isPending} onClick={() => activate.mutate(p.id)}>Kích hoạt lại</Button>}
                </>
              }
            />
            {!p.isActive && status !== 'Ended' && <Callout tone="info">Chương trình đã được lưu và đang tạm dừng. Chọn “Kích hoạt lại” để áp dụng cho đơn mới.</Callout>}
            {p.campaignMode === 'PerSku' ? <Card title="Loại 1 · Điều kiện từng SKU"><SimpleTable rows={p.productRules ?? []} columns={[
              { header: 'SKU / sản phẩm', cell: (r) => namesOf(products.data, [r.productId], (x) => `${x.sku} · ${x.name}`) },
              { header: 'Tối thiểu (thùng)', align: 'right', cell: (r) => r.minimumQuantity },
              { header: '% giảm', align: 'right', cell: (r) => formatPercent(r.discountPercent, 2) },
            ]} /></Card> : <Card title="Loại 2 · Điều kiện chung của nhóm">
              <Fields items={[
                { label: 'Tổng số lượng tối thiểu của nhóm', value: `${p.minimumQuantity} thùng` },
                { label: '% giảm', value: formatPercent(p.discountPercent, 1) },
                { label: 'Loại', value: 'Loại 2 · Theo nhóm sản phẩm' },
              ]} />
            </Card>}
            <Card title="Đối tượng áp dụng">
              <Fields items={[
                { label: 'SKU', value: namesOf(products.data, p.productIds, (x) => `${x.sku} · ${x.name}`) ?? '—' },
                { label: 'Nhóm hàng', value: namesOf(categories.data, p.categoryIds, (x) => x.name) ?? '—' },
                {
                  label: 'Retailer',
                  value: namesOf(retailers.data, p.retailerIds, (x) => `${x.name} (${x.code})`) ?? 'Tất cả retailer',
                },
              ]} />
            </Card>
          </>
        );
      }}
    </QueryState>
  );
}
