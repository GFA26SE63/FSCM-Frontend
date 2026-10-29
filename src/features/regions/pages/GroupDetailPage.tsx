import { useState } from 'react';
import { useParams } from '@/shared/router/compat';
import {
  Button,
  Card,
  Fields,
  PageHeader,
  QueryState,
  SimpleTable,
} from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { formatMoney } from '@/shared/lib';
import { useGroup } from '../hooks';
import { GroupDialog } from '../components/RegionDialogs';

export function GroupDetailPage() {
  const { code = '' } = useParams();
  const { user } = useAuth();
  const query = useGroup(code);
  const [edit, setEdit] = useState(false);

  const mayManage = can(user, 'salesGroups.manage');

  return (
    <QueryState query={query}>
      {(group) => (
        <>
          <PageHeader
            back="/regions"
            title={`Nhóm ${group.code}`}
            subtitle={group.areaName}
            actions={
              mayManage ? (
                <Button onClick={() => setEdit(true)}>
                  Sửa nhóm
                </Button>
              ) : undefined
            }
          />

          <Card>
            <Fields
              cols={3}
              items={[
                {
                  label: 'Khu vực',
                  value: group.areaName,
                },
                {
                  label: 'Sales Manager',
                  value: group.managerName,
                },
                {
                  label: 'Số retailer',
                  value: group.retailerCount,
                },
              ]}
            />
          </Card>

          <Card title="Thành viên và doanh thu tháng" flush>
            <SimpleTable
              rows={group.memberRows}
              columns={[
                {
                  header: 'Sales',
                  cell: (member) => member.name,
                },
                {
                  header: 'Doanh thu sau KM',
                  align: 'right',
                  cell: (member) =>
                    formatMoney(member.revenueAfterPromo),
                },
                {
                  header: 'Doanh thu trước KM',
                  align: 'right',
                  cell: (member) =>
                    formatMoney(member.revenueBeforePromo),
                },
              ]}
            />
          </Card>

          {mayManage && edit && (
            <GroupDialog
              open
              group={group}
              onClose={() => setEdit(false)}
            />
          )}
        </>
      )}
    </QueryState>
  );
}