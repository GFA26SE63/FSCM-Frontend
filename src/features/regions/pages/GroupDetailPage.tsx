import { useState } from 'react';
import { useParams } from '@/shared/router/compat';
import { Button, Card, Fields, PageHeader, QueryState, SimpleTable } from '@/shared/ui';
import { formatMoney } from '@/shared/lib';
import { useGroup } from '../hooks';
import { GroupDialog } from '../components/RegionDialogs';

export function GroupDetailPage() {
  const { code = '' } = useParams();
  const query = useGroup(code);
  const [edit, setEdit] = useState(false);
  return (
    <QueryState query={query}>
      {(g) => (
        <>
          <PageHeader back="/regions" title={`Nhóm ${g.code}`} subtitle={g.areaName} actions={<Button onClick={() => setEdit(true)}>Sửa nhóm</Button>} />
          <Card><Fields cols={3} items={[{ label: 'Khu vực', value: g.areaName }, { label: 'Sales Manager', value: g.managerName }, { label: 'Số retailer', value: g.retailerCount }]} /></Card>
          <Card title="Thành viên và doanh thu tháng" flush>
            <SimpleTable
              rows={g.memberRows}
              columns={[
                { header: 'Sales', cell: (m) => m.name },
                { header: 'Doanh thu sau KM', align: 'right', cell: (m) => formatMoney(m.revenueAfterPromo) },
                { header: 'Doanh thu trước KM', align: 'right', cell: (m) => formatMoney(m.revenueBeforePromo) },
              ]}
            />
          </Card>
          <GroupDialog open={edit} group={g} onClose={() => setEdit(false)} />
        </>
      )}
    </QueryState>
  );
}
