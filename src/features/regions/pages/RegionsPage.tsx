import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, PageHeader, Tabs, type Column } from '@/shared/ui';
import { useAreas, useGroups } from '../hooks';
import { AreaDialog, GroupDialog, TransferStaffDialog } from '../components/RegionDialogs';
import type { Area, SalesGroup } from '../types';

/** "Khu vực & nhóm Sales" – areas (with ward lists) and Sales groups; Sales Manager sees the same screen. */
export function RegionsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'groups' | 'areas'>('groups');
  const areas = useAreas();
  const groups = useGroups();
  const [areaDlg, setAreaDlg] = useState(false);
  const [groupDlg, setGroupDlg] = useState<{ group: SalesGroup | null } | null>(null);
  const [transferDlg, setTransferDlg] = useState(false);

  const aCols: Column<Area>[] = [
    { key: 'code', header: 'Mã', width: '90px', render: (a) => <span className="bold">{a.code}</span> },
    { key: 'name', header: 'Khu vực', width: '160px' },
    { key: 'region', header: 'Vùng', width: '110px' },
    { key: 'manager', header: 'Sales Manager', width: '150px', text: (a) => a.managerName },
    { key: 'wards', header: 'Phường / xã', text: (a) => a.wards.join(', ') },
    { key: 'groups', header: 'Nhóm Sales', width: '150px', text: (a) => a.groups.join(', ') },
    { key: 'retailers', header: 'Retailer', width: '90px', align: 'right', text: (a) => a.retailerCount },
  ];
  const gCols: Column<SalesGroup>[] = [
    { key: 'code', header: 'Mã nhóm', width: '100px', render: (g) => <span className="bold">{g.code}</span> },
    { key: 'area', header: 'Khu vực', width: '150px', text: (g) => g.areaName },
    { key: 'manager', header: 'Sales Manager', width: '150px', text: (g) => g.managerName },
    { key: 'members', header: 'Sales', text: (g) => g.members.join(', ') },
    { key: 'retailers', header: 'Retailer', width: '90px', align: 'right', text: (g) => g.retailerCount },
  ];
  return (
    <>
      <PageHeader title="Khu vực & nhóm Sales" subtitle="Một Sales thuộc đúng một nhóm; nhóm thuộc một khu vực do Sales Manager phụ trách." />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'groups', label: 'Nhóm Sales', count: groups.data?.length }, { key: 'areas', label: 'Khu vực', count: areas.data?.length }]} />
      {tab === 'groups' ? (
        <DataTable
          key="g"
          title="Nhóm Sales"
          rows={groups.data}
          loading={groups.isLoading}
          error={groups.error}
          rowKey={(g) => g.code}
          columns={gCols}
          searchPlaceholder="Mã nhóm, khu vực, Sales…"
          filters={[{ label: 'Khu vực', options: [...new Set((groups.data ?? []).map((g) => g.areaName))], value: (g) => g.areaName }]}
          actions={<><Button onClick={() => setTransferDlg(true)}>Chuyển Sales</Button><Button variant="primary" onClick={() => setGroupDlg({ group: null })}>+ Thêm nhóm</Button></>}
          onRowClick={(g) => navigate(`/regions/${g.code}`)}
          rowActionsWidth="150px"
          rowActions={(g) => (<><Button size="sm" onClick={() => navigate(`/regions/${g.code}`)}>Xem</Button><Button size="sm" onClick={() => setGroupDlg({ group: g })}>Sửa</Button></>)}
        />
      ) : (
        <DataTable
          key="a"
          title="Khu vực"
          rows={areas.data}
          loading={areas.isLoading}
          error={areas.error}
          rowKey={(a) => a.code}
          columns={aCols}
          searchPlaceholder="Mã, tên khu vực, phường…"
          actions={<Button variant="primary" onClick={() => setAreaDlg(true)}>+ Thêm khu vực</Button>}
        />
      )}
      <AreaDialog open={areaDlg} onClose={() => setAreaDlg(false)} />
      <GroupDialog open={!!groupDlg} group={groupDlg?.group} onClose={() => setGroupDlg(null)} />
      <TransferStaffDialog open={transferDlg} onClose={() => setTransferDlg(false)} />
    </>
  );
}
