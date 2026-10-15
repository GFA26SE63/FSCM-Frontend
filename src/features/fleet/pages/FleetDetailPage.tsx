import { useState } from 'react';
import { useParams } from '@/shared/router/compat';
import { Button, Card, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { formatDateTime } from '@/shared/lib';
import { useDriver, useVehicle } from '../hooks';
import { DriverDialog, VehicleDialog } from '../components/FleetDialogs';
import type { Trip } from '../types';

const TripsCard = ({ trips }: { trips: Trip[] }) => (
  <Card title="Chuyến giao gần đây" flush>
    <SimpleTable
      rows={trips}
      empty="Chưa có chuyến giao."
      columns={[
        { header: 'Đơn hàng', cell: (t) => t.orderCode },
        { header: 'Retailer', cell: (t) => t.retailerName },
        { header: 'Xuất phát', cell: (t) => formatDateTime(t.departedAt) },
        { header: 'Xe', cell: (t) => t.plate },
        { header: 'Người giao', cell: (t) => t.driverName },
        { header: 'Trạng thái đơn', cell: (t) => <StatusChip domain="order" value={t.status} /> },
      ]}
    />
  </Card>
);

/** Route /fleet/:id – id is a vehicle plate, or a driver code (NG-xxx). */
export function FleetDetailPage() {
  const { id = '' } = useParams();
  const isDriver = id.startsWith('NG-');
  const vehicle = useVehicle(id, !isDriver);
  const driver = useDriver(id, isDriver);
  const [edit, setEdit] = useState(false);
  if (isDriver)
    return (
      <QueryState query={driver}>
        {(d) => (
          <>
            <PageHeader back="/fleet" title={`${d.code} · ${d.name}`} chips={<StatusChip domain="driver" value={d.status} />} actions={<Button onClick={() => setEdit(true)}>Sửa</Button>} />
            <Card title="Thông tin"><Fields cols={3} items={[{ label: 'Mã', value: d.code }, { label: 'Họ tên', value: d.name }, { label: 'Số điện thoại', value: d.phone }, { label: 'Hạng bằng', value: d.licenseClass }]} /></Card>
            <TripsCard trips={d.recentTrips} />
            <DriverDialog open={edit} driver={d} onClose={() => setEdit(false)} />
          </>
        )}
      </QueryState>
    );
  return (
    <QueryState query={vehicle}>
      {(v) => (
        <>
          <PageHeader back="/fleet" title={`Xe ${v.plate}`} subtitle={v.type} chips={<StatusChip domain="vehicle" value={v.status} />} actions={<Button onClick={() => setEdit(true)}>Sửa</Button>} />
          <Card title="Thông tin"><Fields cols={3} items={[{ label: 'Biển số', value: v.plate }, { label: 'Loại xe', value: v.type }, { label: 'Tải trọng', value: `${v.capacity} thùng` }, { label: 'Kho quản lý', value: v.warehouseName }]} /></Card>
          <TripsCard trips={v.recentTrips} />
          <VehicleDialog open={edit} vehicle={v} onClose={() => setEdit(false)} />
        </>
      )}
    </QueryState>
  );
}
