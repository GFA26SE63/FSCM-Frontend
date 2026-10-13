import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatMoney, statusLabels } from '@/shared/lib';
import { useProduct, useProducts } from '../hooks';
import { ProductActions } from '../components/ProductActions';
import { ProductDialog } from '../components/ProductDialog';
import type { Product } from '../types';

/** "Sản phẩm (SKU)" – Draft / Published / Inactive lifecycle with clone ("Tạo bản mới"). */
export function ProductsPage() {
  const navigate = useNavigate();
  const query = useProducts();
  const [editing, setEditing] = useState<{ sku: string | null } | null>(null);
  const columns: Column<Product>[] = [
    { key: 'sku', header: 'SKU', width: '90px', render: (p) => <span className="bold">{p.sku}</span> },
    { key: 'name', header: 'Tên sản phẩm' },
    { key: 'cat', header: 'Danh mục', width: '140px', text: (p) => p.categoryName },
    { key: 'pack', header: 'Quy cách', width: '170px', text: (p) => p.packSpec },
    { key: 'price', header: 'Giá / thùng', width: '110px', align: 'right', text: (p) => formatMoney(p.basePrice) },
    { key: 'life', header: 'Hạn dùng', width: '100px', align: 'right', text: (p) => `${p.shelfLifeDays} ngày` },
    { key: 'status', header: 'Trạng thái', width: '115px', render: (p) => <StatusChip domain="product" value={p.status} /> },
  ];
  return (
    <>
      <PageHeader title="Sản phẩm (SKU)" subtitle="Nháp → Publish (khóa thông tin) → Inactive. Muốn đổi thông tin đã publish: Tạo bản mới." />
      <DataTable
        title="Danh sách sản phẩm"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(p) => p.sku}
        columns={columns}
        searchPlaceholder="SKU, tên, danh mục…"
        filters={[
          { label: 'Trạng thái', options: Object.values(statusLabels.product), value: (p) => statusLabels.product[p.status] },
          { label: 'Danh mục', options: [...new Set((query.data ?? []).map((p) => p.categoryName))], value: (p) => p.categoryName },
        ]}
        actions={<Button variant="primary" onClick={() => setEditing({ sku: null })}>+ Thêm sản phẩm</Button>}
        onRowClick={(p) => navigate(`/skus/${p.sku}`)}
        rowActionsWidth="300px"
        rowActions={(p) => (<><Button size="sm" onClick={() => navigate(`/skus/${p.sku}`)}>Xem</Button><ProductActions p={p} onEdit={() => setEditing({ sku: p.sku })} /></>)}
      />
      <EditHost state={editing} onClose={() => setEditing(null)} />
    </>
  );
}

/** Loads the draft being edited (or none for create) and mounts the dialog. */
function EditHost({ state, onClose }: { state: { sku: string | null } | null; onClose: () => void }) {
  const detail = useProduct(state?.sku ?? '');
  if (!state) return null;
  if (state.sku && !detail.data) return null;
  return <ProductDialog open product={state.sku ? detail.data : null} onClose={onClose} />;
}
