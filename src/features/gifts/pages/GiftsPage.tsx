import { useState } from 'react';
import { Button, DataTable, FormDialog, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatNumber, statusLabels } from '@/shared/lib';
import { useCreateGift, useGifts, useUpdateGift } from '../hooks';
import type { Gift } from '../types';

/** "Quà đổi điểm" – catalogue of gifts retailers can redeem with loyalty points. */
export function GiftsPage() {
  const query = useGifts();
  const create = useCreateGift();
  const update = useUpdateGift();
  const [dlg, setDlg] = useState<{ gift: Gift | null } | null>(null);
  const columns: Column<Gift>[] = [
    { key: 'code', header: 'Mã quà', width: '100px', render: (g) => <span className="bold">{g.code}</span> },
    { key: 'name', header: 'Tên quà' },
    { key: 'points', header: 'Điểm đổi', width: '110px', align: 'right', text: (g) => formatNumber(g.points) },
    { key: 'stock', header: 'Tồn kho', width: '90px', align: 'right', text: (g) => g.stock },
    { key: 'redeemed', header: 'Đã đổi', width: '90px', align: 'right', text: (g) => g.redeemed },
    { key: 'status', header: 'Trạng thái', width: '120px', render: (g) => <StatusChip domain="active" value={g.status} /> },
  ];
  return (
    <>
      <PageHeader title="Quà đổi điểm" subtitle="Danh mục quà tặng. Tồn kho giảm khi Admin / Operator duyệt yêu cầu đổi quà." />
      <DataTable
        title="Danh sách quà"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(g) => g.code}
        columns={columns}
        searchPlaceholder="Mã hoặc tên quà…"
        filters={[{ label: 'Trạng thái', options: [statusLabels.active.Active, statusLabels.active.Paused], value: (g) => statusLabels.active[g.status] }]}
        actions={<Button variant="primary" onClick={() => setDlg({ gift: null })}>+ Thêm quà</Button>}
        rowActionsWidth="90px"
        rowActions={(g) => <Button size="sm" onClick={() => setDlg({ gift: g })}>Sửa</Button>}
      />
      {dlg && (
        <FormDialog
          open
          width={560}
          columns={2}
          title={dlg.gift ? `Sửa quà ${dlg.gift.code}` : 'Thêm quà'}
          submitLabel={dlg.gift ? 'Lưu' : 'Thêm quà'}
          initial={dlg.gift ? { ...dlg.gift } : { name: '', points: '', stock: '', status: 'Active' }}
          fields={[
            { key: 'name', label: 'Tên quà', required: true, span: 2 },
            { key: 'points', label: 'Điểm đổi', type: 'number', required: true, validate: (v) => (Number(v) <= 0 ? 'Phải lớn hơn 0.' : undefined) },
            { key: 'stock', label: 'Tồn kho', type: 'number', required: true },
            { key: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'Active', label: 'Hoạt động' }, { value: 'Paused', label: 'Tạm ngừng' }] },
          ]}
          onClose={() => setDlg(null)}
          onSubmit={async (v) => {
            const input = { name: v.name, points: Number(v.points), stock: Number(v.stock), status: v.status };
            await (dlg.gift ? update.mutateAsync({ ...input, code: dlg.gift.code }) : create.mutateAsync(input));
            setDlg(null);
          }}
        />
      )}
    </>
  );
}
