import { useState } from 'react';
import { useNavigate, useParams } from '@/shared/router/compat';
import { Callout, Card, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib';
import { useProduct } from '../hooks';
import { ProductActions } from '../components/ProductActions';
import { ProductDialog } from '../components/ProductDialog';

export function ProductDetailPage() {
  const { sku = '' } = useParams();
  const navigate = useNavigate();
  const query = useProduct(sku);
  const [edit, setEdit] = useState(false);
  return (
    <QueryState query={query}>
      {(p) => (
        <>
          <PageHeader
            back="/skus"
            title={`${p.sku} · ${p.name}`}
            subtitle={p.categoryName}
            chips={<StatusChip domain="product" value={p.status} />}
            actions={<ProductActions p={p} size="md" onEdit={() => setEdit(true)} onDeleted={() => navigate('/skus')} />}
          />
          {p.status !== 'Draft' && <Callout tone="neutral">Thông tin đã khóa. Dùng "Tạo bản mới" để chỉnh sửa; khi publish bản mới, SKU này chuyển Inactive.</Callout>}
          {p.replaceOf && <Callout tone="info">Bản thay thế cho <a href={`/skus/${p.replaceOf}`} onClick={(e) => { e.preventDefault(); navigate(`/skus/${p.replaceOf}`); }}>{p.replaceOf}</a>.</Callout>}
          {p.replacedBy && <Callout tone="info">Đã được thay thế bởi <a href={`/skus/${p.replacedBy}`} onClick={(e) => { e.preventDefault(); navigate(`/skus/${p.replacedBy}`); }}>{p.replacedBy}</a>.</Callout>}
          <Card title="Thông tin sản phẩm">
            <Fields cols={3} items={[
              { label: 'SKU', value: p.sku }, { label: 'Tên sản phẩm', value: p.name }, { label: 'Danh mục', value: p.categoryName },
              { label: 'Quy cách', value: p.packSpec }, { label: 'Giá bán / thùng', value: formatMoney(p.basePrice) }, { label: 'Giá vốn / thùng', value: formatMoney(p.unitCost) },
              { label: 'Tổng hạn dùng', value: `${p.shelfLifeDays} ngày` }, { label: 'Cận hạn khi còn', value: `${p.nearExpiryDays} ngày` }, { label: 'm mặc định → MLOR', value: `${formatNumber(p.defaultMlor, 2)} → ${formatNumber(p.defaultMlor * p.shelfLifeDays, 1)} ngày` },
            ]} />
          </Card>
          <Card title="Tồn kho theo batch" flush>
            <SimpleTable
              rows={p.batches}
              empty="Chưa có batch."
              columns={[
                { header: 'Kho', cell: (b) => b.warehouseName },
                { header: 'Batch', cell: (b) => b.batchCode },
                { header: 'HSD', cell: (b) => formatDate(b.expiry) },
                { header: 'Khả dụng', align: 'right', cell: (b) => b.available },
              ]}
            />
          </Card>
          <ProductDialog open={edit} product={p} onClose={() => setEdit(false)} />
        </>
      )}
    </QueryState>
  );
}
