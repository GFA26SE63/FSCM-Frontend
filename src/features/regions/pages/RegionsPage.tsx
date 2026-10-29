import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import {
  Button,
  DataTable,
  PageHeader,
  Tabs,
  type Column,
} from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useAreas, useGroups } from '../hooks';
import {
  AreaDialog,
  GroupDialog,
  TransferStaffDialog,
} from '../components/RegionDialogs';
import type { Area, SalesGroup } from '../types';

export function RegionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tab, setTab] = useState<'groups' | 'areas'>('groups');
  const areas = useAreas();
  const groups = useGroups();

  const [areaDlg, setAreaDlg] = useState(false);
  const [groupDlg, setGroupDlg] = useState<{ group: SalesGroup | null } | null>(null);
  const [transferDlg, setTransferDlg] = useState<{ open: boolean; staffName?: string }>({
    open: false,
  });

  const manageRegions = can(user, 'regions.manage');
  const manageGroups = can(user, 'salesGroups.manage');
  const assignTerritory = can(user, 'territory.assign');

  const openGroup = (group: SalesGroup | null) => {
    if (!manageGroups) return;
    setGroupDlg({ group });
  };

  const groupColumns: Column<SalesGroup>[] = [
    {
      key: 'code',
      header: 'Mã nhóm',
      width: '110px',
      render: (group) => <span className="bold">{group.code}</span>,
      text: (group) => group.code,
    },
    {
      key: 'area',
      header: 'Khu vực',
      width: '140px',
      render: (group) => <span>{group.areaName}</span>,
      text: (group) => group.areaName,
    },
    {
      key: 'manager',
      header: 'Sales Manager',
      width: '160px',
      render: (group) => (
        <div>
          <span style={{ fontWeight: 600 }}>{group.managerName}</span>
          <div className="muted small">Quản lý khu vực</div>
        </div>
      ),
      text: (group) => group.managerName,
    },
    {
      key: 'members',
      header: 'Phân công Sales trong nhóm',
      render: (group) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {group.members.map((m) => (
              <span
                key={m}
                style={{
                  display: 'inline-block',
                  background: '#EEF2EC',
                  color: '#1B1F1D',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 500,
                  border: '1px solid #DCE1DA',
                }}
              >
                {m}
              </span>
            ))}
          </div>
          <span className="muted small" style={{ fontSize: 11.5 }}>
            Tổng cộng: <b>{group.members.length}</b> nhân viên Sales
          </span>
        </div>
      ),
      text: (group) => `${group.members.join(', ')} (${group.members.length} Sales)`,
    },
    {
      key: 'retailers',
      header: 'Retailer',
      width: '120px',
      align: 'right',
      render: (group) => <span>{group.retailerCount} điểm bán</span>,
      text: (group) => `${group.retailerCount}`,
    },
  ];

  const areaColumns: Column<Area>[] = [
    {
      key: 'code',
      header: 'Mã khu vực',
      width: '110px',
      render: (area) => <span className="bold">{area.code}</span>,
      text: (area) => area.code,
    },
    {
      key: 'name',
      header: 'Tên khu vực',
      width: '160px',
      render: (area) => <span style={{ fontWeight: 600 }}>{area.name}</span>,
      text: (area) => area.name,
    },
    {
      key: 'region',
      header: 'Vùng miền',
      width: '120px',
      text: (area) => area.region,
    },
    {
      key: 'manager',
      header: 'Sales Manager',
      width: '160px',
      render: (area) => (
        <div>
          <span style={{ fontWeight: 600 }}>{area.managerName}</span>
          <div className="muted small">Giám sát khu vực</div>
        </div>
      ),
      text: (area) => area.managerName,
    },
    {
      key: 'wards',
      header: 'Phường / Xã trực thuộc',
      render: (area) => (
        <span className="small muted">
          {area.wards.length > 0 ? area.wards.join(', ') : '— Chưa khai báo'}
        </span>
      ),
      text: (area) => area.wards.join(', '),
    },
    {
      key: 'groups',
      header: 'Nhóm trực thuộc',
      width: '160px',
      render: (area) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {area.groups.map((g) => (
            <span
              key={g}
              style={{
                background: '#E2E8F0',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {g}
            </span>
          ))}
        </div>
      ),
      text: (area) => area.groups.join(', '),
    },
    {
      key: 'retailers',
      header: 'Retailer',
      width: '120px',
      align: 'right',
      render: (area) => <span>{area.retailerCount} điểm bán</span>,
      text: (area) => `${area.retailerCount}`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Khu vực & nhóm Sales"
        subtitle="Quản lý khu vực địa lý, nhóm phụ trách và phân công nhân viên Sales."
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          {
            key: 'groups',
            label: 'Nhóm Sales',
            count: groups.data?.length,
          },
          {
            key: 'areas',
            label: 'Khu vực',
            count: areas.data?.length,
          },
        ]}
      />

      {tab === 'groups' ? (
        <DataTable
          key="groups"
          title="Danh sách nhóm Sales"
          rows={groups.data}
          loading={groups.isLoading}
          error={groups.error}
          rowKey={(group) => group.code}
          columns={groupColumns}
          searchPlaceholder="Mã nhóm, khu vực, Sales Manager, tên Sales…"
          filters={[
            {
              label: 'Khu vực',
              options: [
                ...new Set((groups.data ?? []).map((group) => group.areaName)),
              ],
              value: (group) => group.areaName,
            },
          ]}
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              {assignTerritory && (
                <Button onClick={() => setTransferDlg({ open: true })}>
                  Chuyển Sales
                </Button>
              )}
              {manageGroups && (
                <Button variant="primary" onClick={() => openGroup(null)}>
                  + Thêm nhóm
                </Button>
              )}
            </div>
          }
          onRowClick={(group) => navigate(`/regions/${group.code}`)}
          rowActionsWidth="220px"
          rowActions={(group) => (
            <>
              <Button
                size="sm"
                onClick={() => navigate(`/regions/${group.code}`)}
              >
                Xem
              </Button>
              {manageGroups && (
                <Button size="sm" onClick={() => openGroup(group)}>
                  Sửa
                </Button>
              )}
              {assignTerritory && (
                <Button
                  size="sm"
                  onClick={() =>
                    setTransferDlg({
                      open: true,
                      staffName: group.members[0],
                    })
                  }
                >
                  Điều chuyển
                </Button>
              )}
            </>
          )}
        />
      ) : (
        <DataTable
          key="areas"
          title="Danh sách khu vực"
          rows={areas.data}
          loading={areas.isLoading}
          error={areas.error}
          rowKey={(area) => area.code}
          columns={areaColumns}
          searchPlaceholder="Mã, tên khu vực, Sales Manager, phường/xã…"
          actions={
            manageRegions ? (
              <Button variant="primary" onClick={() => setAreaDlg(true)}>
                + Thêm khu vực
              </Button>
            ) : undefined
          }
        />
      )}

      {manageRegions && (
        <AreaDialog open={areaDlg} onClose={() => setAreaDlg(false)} />
      )}

      {manageGroups && (
        <GroupDialog
          open={groupDlg !== null}
          group={groupDlg?.group}
          onClose={() => setGroupDlg(null)}
        />
      )}

      {assignTerritory && (
        <TransferStaffDialog
          open={transferDlg.open}
          initialStaffName={transferDlg.staffName}
          onClose={() => setTransferDlg({ open: false })}
        />
      )}
    </>
  );
}
