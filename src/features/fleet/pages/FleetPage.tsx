import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, PageHeader, StatusChip, Tabs, type Column } from '@/shared/ui';
import { statusLabels } from '@/shared/lib';
import { useDrivers, useVehicles } from '../hooks';
import { DriverDialog, VehicleDialog } from '../components/FleetDialogs';
import type { Driver, Vehicle } from '../types';

/** "Xe & người giao" – master data used by the dispatch dialog (no accounts, no trip optimisation). */
export function FleetPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'vehicles' | 'drivers'>('vehicles');
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const [vDlg, setVDlg] = useState<{ item: Vehicle | null } | null>(null);
  const [dDlg, setDDlg] = useState<{ item: Driver | null } | null>(null);

  const vCols: Column<Vehicle>[] = [
    { key: 'plate', header: 'Biển số', width: '130px', render: (v) => <span className="bold">{v.plate}</span> },
    { key: 'type', header: 'Loại xe' },
    { key: 'capacity', header: 'Tải trọng', width: '110px', align: 'right', text: (v) => `${v.capacity} thùng` },
    { key: 'wh', header: 'Kho quản lý', text: (v) => v.warehouseName },
    { key: 'status', header: 'Trạng thái', width: '120px', render: (v) => <StatusChip domain="vehicle" value={v.status} /> },
  ];
  const dCols: Column<Driver>[] = [
    { key: 'code', header: 'Mã', width: '90px', render: (d) => <span className="bold">{d.code}</span> },
    { key: 'name', header: 'Họ tên' },
    { key: 'phone', header: 'Số điện thoại', width: '140px' },
    { key: 'license', header: 'Hạng bằng', width: '100px', text: (d) => d.licenseClass },
    { key: 'status', header: 'Trạng thái', width: '120px', render: (d) => <StatusChip domain="driver" value={d.status} /> },
  ];

  return (
    <>
      <PageHeader title="Xe & người giao" subtitle="Danh mục dùng cho thao tác Cập nhật Đang giao; đơn lưu snapshot biển số, tên, SĐT." />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'vehicles', label: 'Xe giao hàng', count: vehicles.data?.length }, { key: 'drivers', label: 'Người giao', count: drivers.data?.length }]} />
      {tab === 'vehicles' ? (
        <DataTable
          key="v"
          title="Danh sách xe"
          rows={vehicles.data}
          loading={vehicles.isLoading}
          error={vehicles.error}
          rowKey={(v) => v.plate}
          columns={vCols}
          searchPlaceholder="Biển số, loại xe, kho…"
          filters={[{ label: 'Trạng thái', options: Object.values(statusLabels.vehicle), value: (v) => statusLabels.vehicle[v.status] }]}
          actions={<Button variant="primary" onClick={() => setVDlg({ item: null })}>+ Thêm xe</Button>}
          onRowClick={(v) => navigate(`/fleet/${encodeURIComponent(v.plate)}`)}
          rowActionsWidth="150px"
          rowActions={(v) => (<><Button size="sm" onClick={() => navigate(`/fleet/${encodeURIComponent(v.plate)}`)}>Xem</Button><Button size="sm" onClick={() => setVDlg({ item: v })}>Sửa</Button></>)}
        />
      ) : (
        <DataTable
          key="d"
          title="Danh sách người giao"
          rows={drivers.data}
          loading={drivers.isLoading}
          error={drivers.error}
          rowKey={(d) => d.code}
          columns={dCols}
          searchPlaceholder="Mã, họ tên, số điện thoại…"
          filters={[{ label: 'Trạng thái', options: Object.values(statusLabels.driver), value: (d) => statusLabels.driver[d.status] }]}
          actions={<Button variant="primary" onClick={() => setDDlg({ item: null })}>+ Thêm người giao</Button>}
          onRowClick={(d) => navigate(`/fleet/${d.code}`)}
          rowActionsWidth="150px"
          rowActions={(d) => (<><Button size="sm" onClick={() => navigate(`/fleet/${d.code}`)}>Xem</Button><Button size="sm" onClick={() => setDDlg({ item: d })}>Sửa</Button></>)}
        />
      )}
      <VehicleDialog open={!!vDlg} vehicle={vDlg?.item} onClose={() => setVDlg(null)} />
      <DriverDialog open={!!dDlg} driver={dDlg?.item} onClose={() => setDDlg(null)} />
    </>
  );
}
