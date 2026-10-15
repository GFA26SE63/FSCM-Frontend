import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { statusLabels } from '@/shared/lib';
import { useCategories } from '../hooks';
import { CategoryDialog } from '../components/CategoryDialog';
import type { Category } from '../types';

export function CategoriesPage() {
  const navigate = useNavigate();
  const query = useCategories();
  const [dlg, setDlg] = useState<{ category: Category | null } | null>(null);
  const columns: Column<Category>[] = [
    { key: 'code', header: 'Mã', width: '100px', render: (c) => <span className="bold">{c.code}</span> },
    { key: 'name', header: 'Tên danh mục', width: '200px' },
    { key: 'description', header: 'Mô tả' },
    { key: 'count', header: 'Số SKU', width: '90px', align: 'right', text: (c) => c.productCount },
    { key: 'status', header: 'Trạng thái', width: '120px', render: (c) => <StatusChip domain="active" value={c.status} /> },
  ];
  return (
    <>
      <PageHeader title="Danh mục sản phẩm" subtitle="Nhóm các SKU theo loại sản phẩm." />
      <DataTable
        title="Danh mục"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(c) => c.code}
        columns={columns}
        searchPlaceholder="Mã, tên, mô tả…"
        filters={[{ label: 'Trạng thái', options: [statusLabels.active.Active, statusLabels.active.Inactive], value: (c) => statusLabels.active[c.status] }]}
        actions={<Button variant="primary" onClick={() => setDlg({ category: null })}>+ Thêm danh mục</Button>}
        onRowClick={(c) => navigate(`/cats/${c.code}`)}
        rowActionsWidth="150px"
        rowActions={(c) => (<><Button size="sm" onClick={() => navigate(`/cats/${c.code}`)}>Xem</Button><Button size="sm" onClick={() => setDlg({ category: c })}>Sửa</Button></>)}
      />
      <CategoryDialog open={!!dlg} category={dlg?.category} onClose={() => setDlg(null)} />
    </>
  );
}
