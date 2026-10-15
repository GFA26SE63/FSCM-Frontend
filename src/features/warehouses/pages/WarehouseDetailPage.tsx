import { useState } from 'react';
import { useParams } from '@/shared/router/compat';
import { Button, Card, Chip, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { formatKm } from '@/shared/lib';
import { useWarehouse } from '../hooks';
import { WarehouseDialog } from '../components/WarehouseDialog';

export function WarehouseDetailPage() {
  const { code = '' } = useParams();
  const query = useWarehouse(code);
  const [edit, setEdit] = useState(false);
  return (
    <QueryState query={query}>
      {(w) => (
        <>
          <PageHeader back="/whs" title={`${w.code} · ${w.name}`} subtitle={w.address} chips={<><StatusChip domain="warehouseType" value={w.type} /><StatusChip domain="active" value={w.status} /></>} actions={<Button onClick={() => setEdit(true)}>Sửa</Button>} />
          <Card>
            <Fields cols={3} items={[
              { label: 'Thủ kho', value: w.keeperName }, { label: 'Sức chứa', value: `${w.capacityPallets} pallet` }, { label: 'Số batch', value: w.batchCount },
              { label: 'Vĩ độ', value: w.lat }, { label: 'Kinh độ', value: w.lng },
            ]} />
          </Card>
          <Card title="Khoảng cách tới retailer" flush>
            <SimpleTable
              rows={w.retailerDistances}
              columns={[
                { header: 'Retailer', cell: (r) => `${r.retailerName} (${r.retailerCode})` },
                { header: 'Khoảng cách', align: 'right', cell: (r) => formatKm(r.km) },
                { header: 'Thời gian giao', align: 'right', cell: (r) => (r.transitDays == null ? '—' : `${r.transitDays} ngày`) },
                { header: 'Phạm vi phục vụ', cell: (r) => <Chip tone={r.withinRange ? 'ok' : 'danger'}>{r.withinRange ? 'Trong phạm vi' : 'Ngoài Dmax_retailer'}</Chip> },
              ]}
            />
          </Card>
          <WarehouseDialog open={edit} warehouse={w} onClose={() => setEdit(false)} />
        </>
      )}
    </QueryState>
  );
}
