import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { statusLabels } from '@/shared/lib';
import { useWarehouses } from '../hooks';
import { WarehouseDialog } from '../components/WarehouseDialog';
import type { Warehouse } from '../types';

export function WarehousesPage() {
  const navigate = useNavigate();
  const query = useWarehouses();
  const [dlg, setDlg] = useState<{ warehouse: Warehouse | null } | null>(null);
  const columns: Column<Warehouse>[] = [
    { key: 'code', header: 'Mã kho', width: '90px', render: (w) => <span className="bold">{w.code}</span> },
    { key: 'name', header: 'Tên kho', width: '180px' },
    { key: 'type', header: 'Loại', width: '100px', render: (w) => <StatusChip domain="warehouseType" value={w.type} /> },
    { key: 'address', header: 'Địa chỉ' },
    { key: 'keeper', header: 'Thủ kho', width: '140px', text: (w) => w.keeperName },
    { key: 'cap', header: 'Sức chứa', width: '100px', align: 'right', text: (w) => `${w.capacityPallets} pallet` },
    { key: 'batches', header: 'Batch', width: '70px', align: 'right', text: (w) => w.batchCount },
    { key: 'status', header: 'Trạng thái', width: '115px', render: (w) => <StatusChip domain="active" value={w.status} /> },
  ];
  return (
    <>
      <PageHeader title="Kho" subtitle="Danh mục kho tổng và kho vùng." />
      <DataTable
        title="Danh sách kho"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(w) => w.code}
        columns={columns}
        searchPlaceholder="Mã kho, tên, địa chỉ, thủ kho…"
        filters={[{ label: 'Loại kho', options: Object.values(statusLabels.warehouseType), value: (w) => statusLabels.warehouseType[w.type] }]}
        actions={<Button variant="primary" onClick={() => setDlg({ warehouse: null })}>+ Thêm kho</Button>}
        onRowClick={(w) => navigate(`/whs/${w.code}`)}
        rowActionsWidth="150px"
        rowActions={(w) => (<><Button size="sm" onClick={() => navigate(`/whs/${w.code}`)}>Xem</Button><Button size="sm" onClick={() => setDlg({ warehouse: w })}>Sửa</Button></>)}
      />
      <WarehouseDialog open={!!dlg} warehouse={dlg?.warehouse} onClose={() => setDlg(null)} />
    </>
  );
}
