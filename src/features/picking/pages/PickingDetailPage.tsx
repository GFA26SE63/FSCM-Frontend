import { useParams } from '@/shared/router/compat';
import { Button, Card, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { formatCases, formatDate } from '@/shared/lib';
import { usePickingList, useScanPicking, useShipPicking } from '../hooks';

export function PickingDetailPage() {
  const { code = '' } = useParams();
  const query = usePickingList(code);
  const scan = useScanPicking();
  const ship = useShipPicking();
  return (
    <QueryState query={query}>
      {(p) => (
        <>
          <PageHeader
            back="/picking"
            title={`Picking list ${p.code}`}
            subtitle={`${p.warehouseName} · đơn ${p.orderCode}`}
            chips={<StatusChip domain="picking" value={p.status} />}
            actions={
              <>
                {p.status === 'NotPicked' && <Button variant="primary" loading={scan.isPending} onClick={() => scan.mutate(p.code)}>Bắt đầu pick (quét tem)</Button>}
                {p.status === 'Picking' && <Button variant="primary" loading={ship.isPending} onClick={() => ship.mutate(p.code)}>Xác nhận xuất kho</Button>}
              </>
            }
          />
          <Card title="Thông tin">
            <Fields cols={3} items={[
              { label: 'Kho', value: p.warehouseName },
              { label: 'Thủ kho', value: p.keeperName },
              { label: 'Đơn hàng', value: p.orderCode },
              { label: 'Số dòng', value: p.lineCount },
              { label: 'Tổng số lượng', value: formatCases(p.totalQty) },
            ]} />
          </Card>
          <Card title="Hàng cần soạn" flush>
            <SimpleTable
              rows={p.lines}
              columns={[
                { header: 'SKU', width: '90px', cell: (l) => l.sku },
                { header: 'Sản phẩm', cell: (l) => l.productName },
                { header: 'Batch', cell: (l) => l.batchCode },
                { header: 'HSD', cell: (l) => formatDate(l.expiry) },
                { header: 'Số lượng', align: 'right', cell: (l) => formatCases(l.qty) },
              ]}
            />
          </Card>
        </>
      )}
    </QueryState>
  );
}
