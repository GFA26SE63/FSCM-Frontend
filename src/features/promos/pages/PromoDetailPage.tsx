import { useParams } from 'react-router-dom';
import { Button, Card, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { formatDate, formatDateTime, formatMoney } from '@/shared/lib';
import { useActivatePromo, usePausePromo, usePromo } from '../hooks';

export function PromoDetailPage() {
  const { code = '' } = useParams();
  const query = usePromo(code);
  const pause = usePausePromo();
  const activate = useActivatePromo();
  return (
    <QueryState query={query}>
      {(p) => (
        <>
          <PageHeader
            back="/promos"
            title={`${p.code} · ${p.name}`}
            subtitle={`${p.type === 'PerSku' ? 'Theo từng SKU' : 'Nhóm sản phẩm'} · ${formatDate(p.validFrom)} – ${formatDate(p.validTo)}`}
            chips={<StatusChip domain="promotion" value={p.status} />}
            actions={
              <>
                {p.status === 'Running' && <Button variant="danger" loading={pause.isPending} onClick={() => pause.mutate(p.code)}>Tạm dừng</Button>}
                {p.status === 'Paused' && <Button variant="primary" loading={activate.isPending} onClick={() => activate.mutate(p.code)}>Kích hoạt lại</Button>}
              </>
            }
          />
          <Card title="Quy tắc" flush={p.type === 'PerSku'}>
            {p.type === 'PerSku' ? (
              <SimpleTable
                rows={p.rules}
                columns={[
                  { header: 'SKU', cell: (r) => r.sku },
                  { header: 'Sản phẩm', cell: (r) => r.productName },
                  { header: 'Mua tối thiểu', align: 'right', cell: (r) => `${r.minQty} thùng` },
                  { header: '% giảm', align: 'right', cell: (r) => `${r.discountPct}%` },
                ]}
              />
            ) : (
              <Fields items={[
                { label: 'Nhóm sản phẩm', value: p.group?.skus.join(', ') },
                { label: 'Tổng tối thiểu', value: `${p.group?.minQty} thùng` },
                { label: '% giảm chung', value: `${p.group?.discountPct}%` },
              ]} />
            )}
          </Card>
          <Card title="Khách hàng áp dụng">
            {p.retailers ? p.retailers.map((r) => `${r.name} (${r.code})`).join(' · ') : 'Tất cả retailer'}
          </Card>
          <Card title={`Đơn hàng đã áp dụng · tổng giảm ${formatMoney(p.totalDiscount)}`} flush>
            <SimpleTable
              rows={p.appliedOrders}
              empty="Chưa có đơn nào áp dụng."
              columns={[
                { header: 'Đơn hàng', cell: (a) => a.orderCode },
                { header: 'Retailer', cell: (a) => a.retailerName },
                { header: 'Sales', cell: (a) => a.salesName },
                { header: 'Ngày tạo', cell: (a) => formatDateTime(a.createdAt) },
                { header: 'Chi tiết', cell: (a) => a.detail },
                { header: 'Giảm', align: 'right', cell: (a) => formatMoney(a.amount) },
              ]}
            />
          </Card>
        </>
      )}
    </QueryState>
  );
}
