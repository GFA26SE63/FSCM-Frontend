import { FormDialog, type FormFieldDef } from '@/shared/ui';

import {
  useCreateVehicle,
  useFleetWarehouses,
  useUpdateVehicle,
} from '../hooks';
import type { Vehicle } from '../types';
import { WarehouseLookupNotice } from './WarehouseLookupNotice';

interface Props {
  vehicle: Vehicle | null;
  onClose: () => void;
}

export function VehicleDialog({ vehicle, onClose }: Props) {
  const warehouses = useFleetWarehouses(!vehicle);
  const create = useCreateVehicle();
  const update = useUpdateVehicle();

  const activeWarehouses = (warehouses.data ?? []).filter(
    (item) => item.isActive,
  );

  if (
    !vehicle &&
    (
      warehouses.isPending ||
      warehouses.error ||
      activeWarehouses.length === 0
    )
  ) {
    return (
      <WarehouseLookupNotice
        title="Thêm xe"
        loading={warehouses.isPending}
        error={warehouses.error}
        onRetry={() => void warehouses.refetch()}
        onClose={onClose}
      />
    );
  }

  const fields: FormFieldDef[] = [
    ...(vehicle
      ? [
          {
            key: 'plateNumber',
            label: 'Biển số',
            type: 'info' as const,
          },
          {
            key: 'warehouseId',
            label: 'Kho quản lý (ID)',
            type: 'info' as const,
          },
        ]
      : [
          {
            key: 'warehouseId',
            label: 'Kho quản lý',
            type: 'select' as const,
            required: true,
            options: activeWarehouses.map((item) => ({
              value: item.id,
              label: `${item.code} · ${item.name}`,
            })),
          },
          {
            key: 'plateNumber',
            label: 'Biển số',
            required: true,
            placeholder: '51C-482.17',
            validate: (value: unknown) =>
              String(value).trim().length > 30
                ? 'Tối đa 30 ký tự.'
                : undefined,
          },
        ]),

    {
      key: 'vehicleType',
      label: 'Loại xe',
      required: true,
      placeholder: 'Ví dụ: Xe tải lạnh',
      validate: (value) =>
        String(value).trim().length > 50
          ? 'Tối đa 50 ký tự.'
          : undefined,
    },
    {
      key: 'capacity',
      label: 'Sức chứa (thùng)',
      type: 'number',
      required: true,
      validate: (value) =>
        !Number.isFinite(Number(value)) || Number(value) <= 0
          ? 'Sức chứa phải là số lớn hơn 0.'
          : undefined,
    },
  ];

  return (
    <FormDialog
      open
      title={vehicle ? `Sửa xe ${vehicle.plateNumber}` : 'Thêm xe'}
      width={640}
      submitLabel={vehicle ? 'Lưu thay đổi' : 'Thêm xe'}
      note={
        vehicle
          ? 'Kho quản lý và biển số không thay đổi sau khi tạo.'
          : 'Xe mới được tạo ở trạng thái hoạt động.'
      }
      initial={
        vehicle
          ? { ...vehicle }
          : {
              warehouseId: '',
              plateNumber: '',
              vehicleType: '',
              capacity: '',
            }
      }
      fields={fields}
      onClose={onClose}
      onSubmit={async (values) => {
        const input = {
          vehicleType: String(values.vehicleType).trim(),
          capacity: Number(values.capacity),
        };

        if (vehicle) {
          await update.mutateAsync({
            id: vehicle.id,
            input,
          });
        } else {
          await create.mutateAsync({
            ...input,
            warehouseId: String(values.warehouseId),
            plateNumber: String(values.plateNumber).trim(),
          });
        }

        onClose();
      }}
    />
  );
}