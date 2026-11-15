import { useState } from 'react';

import { useParams } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { errorMessage } from '@/shared/api/errors';
import {
  Button,
  Callout,
  Card,
  Fields,
  PageHeader,
  QueryState,
} from '@/shared/ui';

import {
  useDriver,
  useFleetWarehouses,
  useVehicle,
} from '../hooks';
import {
  activeText,
  warehouseText,
  type FleetStatusTarget,
} from '../types';
import { DriverDialog } from '../components/DriverDialog';
import { VehicleDialog } from '../components/VehicleDialog';
import { FleetStatusDialog } from '../components/FleetStatusDialog';

export function FleetDetailPage() {
  const { kind = '', id = '' } = useParams();
  const { user } = useAuth();

  if (!can(user, 'fleet.manage')) {
    return <Callout tone="danger">Bạn không có quyền truy cập.</Callout>;
  }

  if (!id || !['vehicles', 'drivers'].includes(kind)) {
    return <Callout tone="danger">Đường dẫn xe hoặc tài xế không hợp lệ.</Callout>;
  }

  return (
    <FleetDetail
      key={`${user?.id}:${kind}:${id}`}
      kind={kind}
      id={id}
    />
  );
}

function FleetDetail({ kind, id }: { kind: string; id: string }) {
  const vehicle = useVehicle(id, kind === 'vehicles');
  const driver = useDriver(id, kind === 'drivers');
  const warehouses = useFleetWarehouses();

  const [edit, setEdit] = useState(false);
  const [statusTarget, setStatusTarget] =
    useState<FleetStatusTarget | null>(null);

  const warehouseWarning = warehouses.error ? (
    <Callout tone="danger">
      Không tải được tên kho: {errorMessage(warehouses.error)}.{' '}
      <Button size="sm" onClick={() => void warehouses.refetch()}>
        Thử lại
      </Button>
    </Callout>
  ) : null;

  if (kind === 'drivers') {
    return (
      <QueryState query={driver}>
        {(item) => (
          <>
            <PageHeader
              back="/fleet"
              title={`${item.code} · ${item.fullName}`}
              chips={<span className="chip">{activeText(item.isActive)}</span>}
              actions={
                <>
                  <Button onClick={() => void driver.refetch()}>Tải lại</Button>
                  <Button onClick={() => setEdit(true)}>Sửa</Button>
                  <Button
                    onClick={() => setStatusTarget({ kind: 'driver', item })}
                  >
                    {item.isActive ? 'Ngừng hoạt động' : 'Kích hoạt'}
                  </Button>
                </>
              }
            />

            {warehouseWarning}

            <Card title="Thông tin tài xế">
              <Fields
                cols={2}
                items={[
                  { label: 'Mã tài xế', value: item.code },
                  { label: 'Họ tên', value: item.fullName },
                  { label: 'Điện thoại', value: item.phone },
                  { label: 'Số GPLX', value: item.licenseNumber },
                  {
                    label: 'Kho quản lý',
                    value: warehouseText(warehouses.data, item.warehouseId),
                  },
                  { label: 'Trạng thái', value: activeText(item.isActive) },
                ]}
              />
            </Card>

            {edit && (
              <DriverDialog
                driver={item}
                onClose={() => setEdit(false)}
              />
            )}

            {statusTarget && (
              <FleetStatusDialog
                target={statusTarget}
                onClose={() => setStatusTarget(null)}
              />
            )}
          </>
        )}
      </QueryState>
    );
  }

  return (
    <QueryState query={vehicle}>
      {(item) => (
        <>
          <PageHeader
            back="/fleet"
            title={`Xe ${item.plateNumber}`}
            subtitle={item.vehicleType}
            chips={<span className="chip">{activeText(item.isActive)}</span>}
            actions={
              <>
                <Button onClick={() => void vehicle.refetch()}>Tải lại</Button>
                <Button onClick={() => setEdit(true)}>Sửa</Button>
                <Button
                  onClick={() => setStatusTarget({ kind: 'vehicle', item })}
                >
                  {item.isActive ? 'Ngừng hoạt động' : 'Kích hoạt'}
                </Button>
              </>
            }
          />

          {warehouseWarning}

          <Card title="Thông tin xe">
            <Fields
              cols={2}
              items={[
                { label: 'Biển số', value: item.plateNumber },
                { label: 'Loại xe', value: item.vehicleType },
                {
                  label: 'Sức chứa',
                  value: `${item.capacity.toLocaleString('vi-VN')} thùng`,
                },
                {
                  label: 'Kho quản lý',
                  value: warehouseText(warehouses.data, item.warehouseId),
                },
                { label: 'Trạng thái', value: activeText(item.isActive) },
              ]}
            />
          </Card>

          {edit && (
            <VehicleDialog
              vehicle={item}
              onClose={() => setEdit(false)}
            />
          )}

          {statusTarget && (
            <FleetStatusDialog
              target={statusTarget}
              onClose={() => setStatusTarget(null)}
            />
          )}
        </>
      )}
    </QueryState>
  );
}