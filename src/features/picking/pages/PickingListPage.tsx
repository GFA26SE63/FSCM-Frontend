import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatCases, statusLabel, statusLabels } from '@/shared/lib';
import { usePickingLists, useScanPicking, useShipPicking } from '../hooks';
import type { PickingList } from '../types';

/** "Picking list" – one list per warehouse of an approved order (code = order code + A/B/C). */
export function PickingListPage() {
  const navigate = useNavigate();
  const query = usePickingLists();
  const scan = useScanPicking();
  const ship = useShipPicking();
  const columns: Column<PickingList>[] = [
    { key: 'code', header: 'Mã picking', width: '120px', render: (p) => <span className="bold">{p.code}</span> },
    { key: 'order', header: 'Đơn hàng', width: '110px', text: (p) => p.orderCode },
    { key: 'wh', header: 'Kho', text: (p) => p.warehouseName },
    { key: 'keeper', header: 'Thủ kho', width: '140px', text: (p) => p.keeperName },
    { key: 'lines', header: 'Số dòng', width: '80px', align: 'right', text: (p) => p.lineCount },
    { key: 'qty', header: 'Tổng SL', width: '110px', align: 'right', text: (p) => formatCases(p.totalQty) },
    { key: 'status', header: 'Trạng thái', width: '120px', render: (p) => <StatusChip domain="picking" value={p.status} /> },
  ];
  return (
    <>
      <PageHeader title="Picking list" subtitle="Soạn hàng theo batch gần hết hạn trước; quét tem batch rồi xác nhận xuất kho." />
      <DataTable
        title="Danh sách picking"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(p) => p.code}
        columns={columns}
        searchPlaceholder="Mã picking, đơn hàng, kho…"
        filters={[{ label: 'Trạng thái', options: Object.values(statusLabels.picking), value: (p) => statusLabel('picking', p.status) }]}
        onRowClick={(p) => navigate(`/picking/${p.code}`)}
        rowActionsWidth="220px"
        rowActions={(p) => (
          <>
            <Button size="sm" onClick={() => navigate(`/picking/${p.code}`)}>Xem</Button>
            {p.status === 'NotPicked' && <Button size="sm" variant="primary" onClick={() => scan.mutate(p.code)}>Bắt đầu pick</Button>}
            {p.status === 'Picking' && <Button size="sm" variant="primary" onClick={() => ship.mutate(p.code)}>Xác nhận xuất</Button>}
          </>
        )}
      />
    </>
  );
}
