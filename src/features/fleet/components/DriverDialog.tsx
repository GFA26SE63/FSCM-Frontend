import { FormDialog, type FormFieldDef } from '@/shared/ui';

import {
  useCreateDriver,
  useFleetWarehouses,
  useUpdateDriver,
} from '../hooks';
import type { Driver } from '../types';
import { WarehouseLookupNotice } from './WarehouseLookupNotice';

interface Props {
  driver: Driver | null;
  onClose: () => void;
}

export function DriverDialog({ driver, onClose }: Props) {
  const warehouses = useFleetWarehouses(!driver);
  const create = useCreateDriver();
  const update = useUpdateDriver();

  const activeWarehouses = (warehouses.data ?? []).filter(
    (item) => item.isActive,
  );

  if (
    !driver &&
    (
      warehouses.isPending ||
      warehouses.error ||
      activeWarehouses.length === 0
    )
  ) {
    return (
      <WarehouseLookupNotice
        title="Thêm tài xế"
        loading={warehouses.isPending}
        error={warehouses.error}
        onRetry={() => void warehouses.refetch()}
        onClose={onClose}
      />
    );
  }

  const fields: FormFieldDef[] = [
    ...(driver
      ? [
          {
            key: 'code',
            label: 'Mã tài xế',
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
            key: 'code',
            label: 'Mã tài xế',
            hint: 'Để trống để hệ thống cấp mã.',
            validate: (value: unknown) =>
              String(value).trim().length > 20
                ? 'Tối đa 20 ký tự.'
                : undefined,
          },
        ]),

    {
      key: 'fullName',
      label: 'Họ tên',
      required: true,
      validate: (value) =>
        String(value).trim().length > 150
          ? 'Tối đa 150 ký tự.'
          : undefined,
    },
    {
      key: 'phone',
      label: 'Số điện thoại',
      required: true,
      validate: (value) =>
        String(value).trim().length > 30
          ? 'Tối đa 30 ký tự.'
          : undefined,
    },
    {
      key: 'licenseNumber',
      label: 'Số giấy phép lái xe',
      required: true,
      validate: (value) =>
        String(value).trim().length > 80
          ? 'Tối đa 80 ký tự.'
          : undefined,
    },
  ];

  return (
    <FormDialog
      open
      title={driver ? `Sửa tài xế ${driver.code}` : 'Thêm tài xế'}
      width={640}
      submitLabel={driver ? 'Lưu thay đổi' : 'Thêm tài xế'}
      note={
        driver
          ? 'Kho quản lý và mã tài xế không thay đổi sau khi tạo.'
          : 'Tài xế là bản ghi danh mục, không tạo tài khoản đăng nhập.'
      }
      initial={
        driver
          ? { ...driver }
          : {
              warehouseId: '',
              code: '',
              fullName: '',
              phone: '',
              licenseNumber: '',
            }
      }
      fields={fields}
      onClose={onClose}
      onSubmit={async (values) => {
        const input = {
          fullName: String(values.fullName).trim(),
          phone: String(values.phone).trim(),
          licenseNumber: String(values.licenseNumber).trim(),
        };

        if (driver) {
          await update.mutateAsync({
            id: driver.id,
            input,
          });
        } else {
          const code = String(values.code ?? '').trim();

          await create.mutateAsync({
            ...input,
            warehouseId: String(values.warehouseId),
            ...(code ? { code } : {}),
          });
        }

        onClose();
      }}
    />
  );
}