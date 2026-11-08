import { useState } from 'react';

import { useNavigate } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { errorMessage } from '@/shared/api/errors';
import {
  Button,
  Callout,
  DataTable,
  PageHeader,
  Tabs,
  type Column,
} from '@/shared/ui';

import {
  useDrivers,
  useFleetWarehouses,
  useVehicles,
} from '../hooks';
import {
  activeText,
  warehouseText,
  type Driver,
  type FleetStatusTarget,
  type Vehicle,
} from '../types';
import { VehicleDialog } from '../components/VehicleDialog';
import { DriverDialog } from '../components/DriverDialog';
import { FleetStatusDialog } from '../components/FleetStatusDialog';

export function FleetPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const allowed = can(user, 'fleet.manage');

  const vehicles = useVehicles();
  const drivers = useDrivers();
  const warehouses = useFleetWarehouses();

  const [tab, setTab] = useState<'vehicles' | 'drivers'>('vehicles');
  const [vehicleDialog, setVehicleDialog] =
    useState<{ item: Vehicle | null } | null>(null);
  const [driverDialog, setDriverDialog] =
    useState<{ item: Driver | null } | null>(null);
  const [statusTarget, setStatusTarget] =
    useState<FleetStatusTarget | null>(null);

  const warehouseLabel = (id: string) =>
    warehouseText(warehouses.data, id);

  const vehicleColumns: Column<Vehicle>[] = [
    {
      key: 'plateNumber',
      header: 'Biển số',
      text: (item) => item.plateNumber,
      render: (item) => <strong>{item.plateNumber}</strong>,
    },
    { key: 'vehicleType', header: 'Loại xe' },
    {
      key: 'capacity',
      header: 'Sức chứa',
      align: 'right',
      text: (item) => `${item.capacity.toLocaleString('vi-VN')} thùng`,
    },
    {
      key: 'warehouse',
      header: 'Kho quản lý',
      text: (item) => warehouseLabel(item.warehouseId),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      text: (item) => activeText(item.isActive),
    },
  ];

  const driverColumns: Column<Driver>[] = [
    { key: 'code', header: 'Mã tài xế' },
    { key: 'fullName', header: 'Họ tên' },
    { key: 'phone', header: 'Điện thoại' },
    { key: 'licenseNumber', header: 'Số GPLX' },
    {
      key: 'warehouse',
      header: 'Kho quản lý',
      text: (item) => warehouseLabel(item.warehouseId),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      text: (item) => activeText(item.isActive),
    },
  ];

  if (!allowed) {
    return <Callout tone="danger">Bạn không có quyền quản lý xe và tài xế.</Callout>;
  }

  return (
    <>
      <PageHeader
        title="Xe & tài xế"
        subtitle="Quản lý danh mục xe và nhân sự giao hàng theo kho."
      />

      {warehouses.error && (
        <Callout tone="danger">
          Không tải được tên kho: {errorMessage(warehouses.error)}.{' '}
          <Button size="sm" onClick={() => void warehouses.refetch()}>
            Thử lại
          </Button>
        </Callout>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          {
            key: 'vehicles',
            label: 'Xe giao hàng',
            count: vehicles.data?.length,
          },
          {
            key: 'drivers',
            label: 'Tài xế',
            count: drivers.data?.length,
          },
        ]}
      />

      {tab === 'vehicles' ? (
        <DataTable
          key="vehicles"
          title="Danh sách xe"
          rows={vehicles.data}
          loading={vehicles.isLoading}
          error={vehicles.error}
          rowKey={(item) => item.id}
          columns={vehicleColumns}
          searchPlaceholder="Biển số, loại xe, kho…"
          filters={[
            {
              label: 'Trạng thái',
              options: ['Hoạt động', 'Ngừng hoạt động'],
              value: (item) => activeText(item.isActive),
            },
            {
              label: 'Kho',
              options: [...new Set(
                (vehicles.data ?? []).map(
                  (item) => warehouseLabel(item.warehouseId),
                ),
              )],
              value: (item) => warehouseLabel(item.warehouseId),
            },
          ]}
          actions={
            <>
              <Button onClick={() => void vehicles.refetch()}>
                Tải lại
              </Button>
              <Button
                variant="primary"
                onClick={() => setVehicleDialog({ item: null })}
              >
                + Thêm xe
              </Button>
            </>
          }
          onRowClick={(item) => navigate(`/fleet/vehicles/${item.id}`)}
          rowActionsWidth="300px"
          rowActions={(item) => (
            <>
              <Button
                size="sm"
                onClick={() => navigate(`/fleet/vehicles/${item.id}`)}
              >
                Xem
              </Button>
              <Button
                size="sm"
                onClick={() => setVehicleDialog({ item })}
              >
                Sửa
              </Button>
              <Button
                size="sm"
                onClick={() => setStatusTarget({ kind: 'vehicle', item })}
              >
                {item.isActive ? 'Ngừng hoạt động' : 'Kích hoạt'}
              </Button>
            </>
          )}
        />
      ) : (
        <DataTable
          key="drivers"
          title="Danh sách tài xế"
          rows={drivers.data}
          loading={drivers.isLoading}
          error={drivers.error}
          rowKey={(item) => item.id}
          columns={driverColumns}
          searchPlaceholder="Mã, họ tên, điện thoại, số GPLX, kho…"
          filters={[
            {
              label: 'Trạng thái',
              options: ['Hoạt động', 'Ngừng hoạt động'],
              value: (item) => activeText(item.isActive),
            },
            {
              label: 'Kho',
              options: [...new Set(
                (drivers.data ?? []).map(
                  (item) => warehouseLabel(item.warehouseId),
                ),
              )],
              value: (item) => warehouseLabel(item.warehouseId),
            },
          ]}
          actions={
            <>
              <Button onClick={() => void drivers.refetch()}>
                Tải lại
              </Button>
              <Button
                variant="primary"
                onClick={() => setDriverDialog({ item: null })}
              >
                + Thêm tài xế
              </Button>
            </>
          }
          onRowClick={(item) => navigate(`/fleet/drivers/${item.id}`)}
          rowActionsWidth="300px"
          rowActions={(item) => (
            <>
              <Button
                size="sm"
                onClick={() => navigate(`/fleet/drivers/${item.id}`)}
              >
                Xem
              </Button>
              <Button
                size="sm"
                onClick={() => setDriverDialog({ item })}
              >
                Sửa
              </Button>
              <Button
                size="sm"
                onClick={() => setStatusTarget({ kind: 'driver', item })}
              >
                {item.isActive ? 'Ngừng hoạt động' : 'Kích hoạt'}
              </Button>
            </>
          )}
        />
      )}

      {vehicleDialog && (
        <VehicleDialog
          key={vehicleDialog.item?.id ?? 'new-vehicle'}
          vehicle={vehicleDialog.item}
          onClose={() => setVehicleDialog(null)}
        />
      )}

      {driverDialog && (
        <DriverDialog
          key={driverDialog.item?.id ?? 'new-driver'}
          driver={driverDialog.item}
          onClose={() => setDriverDialog(null)}
        />
      )}

      {statusTarget && (
        <FleetStatusDialog
          key={`${statusTarget.kind}:${statusTarget.item.id}`}
          target={statusTarget}
          onClose={() => setStatusTarget(null)}
        />
      )}
    </>
  );
}