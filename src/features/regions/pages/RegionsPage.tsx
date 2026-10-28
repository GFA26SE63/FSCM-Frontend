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
import { Can } from '@/shared/auth/Can';
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

  const [tab, setTab] =
    useState<'groups' | 'areas'>('groups');

  const areas = useAreas();
  const groups = useGroups();

  const [areaDlg, setAreaDlg] = useState(false);
  const [groupDlg, setGroupDlg] =
    useState<{ group: SalesGroup | null } | null>(null);
  const [transferDlg, setTransferDlg] = useState(false);

  const manageRegions = can(user, 'regions.manage');
  const manageGroups = can(user, 'salesGroups.manage');
  const assignTerritory = can(user, 'territory.assign');

  const openGroup = (group: SalesGroup | null) => {
    if (!manageGroups) return;
    setGroupDlg({ group });
  };

  const areaColumns: Column<Area>[] = [
    {
      key: 'code',
      header: 'Mã',
      width: '90px',
      render: (area) => (
        <span className="bold">{area.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Khu vực',
      width: '160px',
    },
    {
      key: 'region',
      header: 'Vùng',
      width: '110px',
    },
    {
      key: 'manager',
      header: 'Sales Manager',
      width: '150px',
      text: (area) => area.managerName,
    },
    {
      key: 'wards',
      header: 'Phường / xã',
      text: (area) => area.wards.join(', '),
    },
    {
      key: 'groups',
      header: 'Nhóm Sales',
      width: '150px',
      text: (area) => area.groups.join(', '),
    },
    {
      key: 'retailers',
      header: 'Retailer',
      width: '90px',
      align: 'right',
      text: (area) => area.retailerCount,
    },
  ];

  const groupColumns: Column<SalesGroup>[] = [
    {
      key: 'code',
      header: 'Mã nhóm',
      width: '100px',
      render: (group) => (
        <span className="bold">{group.code}</span>
      ),
    },
    {
      key: 'area',
      header: 'Khu vực',
      width: '150px',
      text: (group) => group.areaName,
    },
    {
      key: 'manager',
      header: 'Sales Manager',
      width: '150px',
      text: (group) => group.managerName,
    },
    {
      key: 'members',
      header: 'Sales',
      text: (group) => group.members.join(', '),
    },
    {
      key: 'retailers',
      header: 'Retailer',
      width: '90px',
      align: 'right',
      text: (group) => group.retailerCount,
    },
  ];

  return (
    <>
      <PageHeader
        title="Khu vực & nhóm Sales"
        subtitle="Quản lý khu vực, nhóm và phân công Sales."
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
          title="Nhóm Sales"
          rows={groups.data}
          loading={groups.isLoading}
          error={groups.error}
          rowKey={(group) => group.code}
          columns={groupColumns}
          searchPlaceholder="Mã nhóm, khu vực, Sales…"
          filters={[
            {
              label: 'Khu vực',
              options: [
                ...new Set(
                  (groups.data ?? []).map(
                    (group) => group.areaName,
                  ),
                ),
              ],
              value: (group) => group.areaName,
            },
          ]}
          actions={
            <>
              <Can permission="territory.assign">
                <Button
                  onClick={() => {
                    if (!assignTerritory) return;
                    setTransferDlg(true);
                  }}
                >
                  Chuyển Sales
                </Button>
              </Can>

              <Can permission="salesGroups.manage">
                <Button
                  variant="primary"
                  onClick={() => openGroup(null)}
                >
                  + Thêm nhóm
                </Button>
              </Can>
            </>
          }
          onRowClick={(group) =>
            navigate(`/regions/${group.code}`)
          }
          rowActionsWidth="150px"
          rowActions={(group) => (
            <>
              <Button
                size="sm"
                onClick={() =>
                  navigate(`/regions/${group.code}`)
                }
              >
                Xem
              </Button>

              <Can permission="salesGroups.manage">
                <Button
                  size="sm"
                  onClick={() => openGroup(group)}
                >
                  Sửa
                </Button>
              </Can>
            </>
          )}
        />
      ) : (
        <DataTable
          key="areas"
          title="Khu vực"
          rows={areas.data}
          loading={areas.isLoading}
          error={areas.error}
          rowKey={(area) => area.code}
          columns={areaColumns}
          searchPlaceholder="Mã, tên khu vực, phường…"
          actions={
            <Can permission="regions.manage">
              <Button
                variant="primary"
                onClick={() => {
                  if (!manageRegions) return;
                  setAreaDlg(true);
                }}
              >
                + Thêm khu vực
              </Button>
            </Can>
          }
        />
      )}

      {manageRegions && (
        <AreaDialog
          open={areaDlg}
          onClose={() => setAreaDlg(false)}
        />
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
          open={transferDlg}
          onClose={() => setTransferDlg(false)}
        />
      )}
    </>
  );
}