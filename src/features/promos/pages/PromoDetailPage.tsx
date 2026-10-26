import { useParams } from '@/shared/router/compat';
import { Button, Card, Fields, PageHeader, QueryState, StatusChip } from '@/shared/ui';
import { formatDate, formatPercent } from '@/shared/lib';
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
              title={`${p.code} · ${p.name}`}
              subtitle={`Giảm ${formatPercent(p.discountPercent, 1)} khi mua từ ${p.minimumQuantity} thùng · ${formatDate(p.startAt)} – ${formatDate(p.endAt)}`}
              chips={<StatusChip domain="promotion" value={status} />}
              actions={
                <>
                  {status === 'Running' && <Button variant="danger" loading={pause.isPending} onClick={() => pause.mutate(p.id)}>Tạm dừng</Button>}
                  {status === 'Paused' && <Button variant="primary" loading={activate.isPending} onClick={() => activate.mutate(p.id)}>Kích hoạt lại</Button>}
                </>
              }
            />
            <Card title="Mức giảm">
              <Fields items={[
                { label: 'Mua tối thiểu', value: `${p.minimumQuantity} thùng` },
                { label: '% giảm', value: formatPercent(p.discountPercent, 1) },
                { label: 'Loại', value: p.promotionType },
              ]} />
            </Card>
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
