import { useState } from 'react';
import { useNavigate, useParams } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import {
  Button,
  Card,
  Fields,
  PageHeader,
  QueryState,
  SimpleTable,
  StatusChip,
} from '@/shared/ui';
import { formatMoney } from '@/shared/lib';
import { useGroup, useGroupRetailers } from '../hooks';
import { GroupDialog, TransferStaffDialog } from '../components/RegionDialogs';

export function GroupDetailPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const query = useGroup(code);
  const retailersQuery = useGroupRetailers(code);

  const [edit, setEdit] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);

  const manageGroups = can(user, 'salesGroups.manage');
  const assignTerritory = can(user, 'territory.assign');

  return (
    <QueryState query={query}>
      {(g) => (
        <>
          <PageHeader
            back="/regions"
            title={`Nhóm ${g.code}`}
            subtitle={`Khu vực ${g.areaName} · Giám sát bởi ${g.managerName}`}
            actions={
              <div style={{ display: 'flex', gap: 8 }}>
                {assignTerritory && (
                  <Button onClick={() => setTransferTarget(g.members[0] ?? '')}>
                    Chuyển Sales
                  </Button>
                )}
                {manageGroups && (
                  <Button variant="primary" onClick={() => setEdit(true)}>
                    Sửa nhóm
                  </Button>
                )}
              </div>
            }
          />

          <Card>
            <Fields
              cols={3}
              items={[
                { label: 'Mã nhóm', value: g.code },
                { label: 'Khu vực', value: `${g.areaName} (${g.areaCode})` },
                { label: 'Sales Manager', value: g.managerName },
                { label: 'Số Sales phụ trách', value: `${g.members.length} nhân viên` },
                { label: 'Số Retailer phụ trách', value: `${g.retailerCount} điểm bán` },
              ]}
            />
          </Card>

          <Card title={`Thành viên Sales & Doanh số tháng (${g.memberRows?.length ?? g.members.length} nhân viên)`} flush>
            <SimpleTable
              rows={
                g.memberRows?.length
                  ? g.memberRows
                  : g.members.map((m) => ({
                      name: m,
                      groupCode: g.code,
                      revenueAfterPromo: 0,
                      revenueBeforePromo: 0,
                    }))
              }
              empty="Chưa có nhân viên Sales trong nhóm này."
              columns={[
                {
                  header: 'Nhân viên Sales',
                  cell: (m) => <span style={{ fontWeight: 600 }}>{m.name}</span>,
                },
                {
                  header: 'Nhóm phụ trách',
                  cell: () => <span>{g.code}</span>,
                },
                {
                  header: 'Doanh thu sau KM',
                  align: 'right',
                  cell: (m) => formatMoney(m.revenueAfterPromo),
                },
                {
                  header: 'Doanh thu trước KM',
                  align: 'right',
                  cell: (m) => formatMoney(m.revenueBeforePromo),
                },
                {
                  header: 'Thao tác',
                  align: 'center',
                  cell: (m) =>
                    assignTerritory ? (
                      <Button
                        size="sm"
                        onClick={() => setTransferTarget(m.name)}
                      >
                        Chuyển nhóm
                      </Button>
                    ) : null,
                },
              ]}
            />
          </Card>

          <Card
            title={`Danh sách điểm bán (Retailer) do nhóm ${g.code} phụ trách (${retailersQuery.data?.length ?? g.retailerCount} điểm bán)`}
            flush
          >
            <SimpleTable
              rows={retailersQuery.data ?? []}
              empty="Chưa có điểm bán nào được phân công cho nhóm này."
              columns={[
                {
                  header: 'Mã retailer',
                  cell: (r) => (
                    <a
                      href={`/retailers/${r.code}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/retailers/${r.code}`);
                      }}
                      style={{ fontWeight: 600 }}
                    >
                      {r.code}
                    </a>
                  ),
                },
                {
                  header: 'Tên điểm bán',
                  cell: (r) => r.name,
                },
                {
                  header: 'Địa chỉ',
                  cell: (r) => r.address,
                },
                {
                  header: 'Liên hệ',
                  cell: (r) => `${r.contact || '—'} (${r.phone})`,
                },
                {
                  header: 'Quy mô',
                  align: 'center',
                  cell: (r) => r.size,
                },
                {
                  header: 'Tiềm năng',
                  align: 'center',
                  cell: (r) => <StatusChip value={r.potentialClass} />,
                },
                {
                  header: 'Trạng thái',
                  align: 'center',
                  cell: (r) => <StatusChip domain="active" value={r.status} />,
                },
              ]}
            />
          </Card>

          {manageGroups && (
            <GroupDialog open={edit} group={g} onClose={() => setEdit(false)} />
          )}

          {assignTerritory && (
            <TransferStaffDialog
              open={transferTarget !== null}
              initialStaffName={transferTarget ?? undefined}
              onClose={() => setTransferTarget(null)}
            />
          )}
        </>
      )}
    </QueryState>
  );
}
