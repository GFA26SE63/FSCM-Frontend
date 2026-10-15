import { FormDialog, type FormFieldDef } from '@/shared/ui';
import { IdFormat } from '@/shared/lib';
import { useCreateDriver, useCreateVehicle, useFleetWarehouses, useUpdateDriver, useUpdateVehicle } from '../hooks';
import type { Driver, Vehicle } from '../types';

const VEHICLE_TYPES = ['Xe tải lạnh 1 tấn', 'Xe tải lạnh 1,5 tấn', 'Xe tải lạnh 2 tấn', 'Xe tải lạnh 3,5 tấn'];

/** Add / edit a vehicle. Plate is the key, so it is read-only when editing. */
export function VehicleDialog({ open, vehicle, onClose }: { open: boolean; vehicle?: Vehicle | null; onClose: () => void }) {
  const whs = useFleetWarehouses();
  const create = useCreateVehicle();
  const update = useUpdateVehicle();
  if (!open || !whs.data) return null;
  const edit = !!vehicle;
  const fields: FormFieldDef[] = [
    { key: 'plate', label: 'Biển số', required: true, readOnly: edit, placeholder: '51C-482.17', validate: (v) => (!IdFormat.isVehiclePlate(String(v)) ? 'Biển số dạng 51C-482.17.' : undefined) },
    { key: 'type', label: 'Loại xe', type: 'select', required: true, options: VEHICLE_TYPES },
    { key: 'capacity', label: 'Tải trọng (thùng)', type: 'number', required: true, validate: (v) => (Number(v) <= 0 ? 'Phải lớn hơn 0.' : undefined) },
    { key: 'warehouseCode', label: 'Kho quản lý', type: 'select', required: true, options: whs.data.map((w) => ({ value: w.code, label: w.name })) },
    { key: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'Active', label: 'Hoạt động' }, { value: 'Maintenance', label: 'Bảo trì' }] },
  ];
  return (
    <FormDialog
      open
      width={600}
      title={edit ? `Sửa xe ${vehicle!.plate}` : 'Thêm xe'}
      submitLabel={edit ? 'Lưu' : 'Thêm xe'}
      initial={vehicle ? { ...vehicle } : { plate: '', type: VEHICLE_TYPES[0], capacity: '', warehouseCode: whs.data[0]?.code ?? '', status: 'Active' }}
      fields={fields}
      onClose={onClose}
      onSubmit={async (v) => {
        const input = { plate: v.plate, type: v.type, capacity: Number(v.capacity), warehouseCode: v.warehouseCode, status: v.status };
        await (edit ? update : create).mutateAsync(input);
        onClose();
      }}
    />
  );
}

export function DriverDialog({ open, driver, onClose }: { open: boolean; driver?: Driver | null; onClose: () => void }) {
  const create = useCreateDriver();
  const update = useUpdateDriver();
  if (!open) return null;
  const edit = !!driver;
  return (
    <FormDialog
      open
      width={600}
      title={edit ? `Sửa người giao ${driver!.code}` : 'Thêm người giao'}
      submitLabel={edit ? 'Lưu' : 'Thêm người giao'}
      note={edit ? undefined : 'Mã NG-xxx do hệ thống cấp. Người giao chỉ là danh mục, không có tài khoản đăng nhập.'}
      initial={driver ? { ...driver } : { name: '', phone: '', licenseClass: 'C', status: 'Active' }}
      fields={[
        { key: 'name', label: 'Họ tên', required: true },
        { key: 'phone', label: 'Số điện thoại', required: true, validate: (v) => (!IdFormat.isPhone(String(v)) ? 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.' : undefined) },
        { key: 'licenseClass', label: 'Hạng bằng lái', type: 'select', options: ['B2', 'C', 'FC'] },
        { key: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'Active', label: 'Hoạt động' }, { value: 'OnLeave', label: 'Tạm nghỉ' }] },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        const input = { name: v.name, phone: v.phone, licenseClass: v.licenseClass, status: v.status };
        await (edit ? update.mutateAsync({ ...input, code: driver!.code }) : create.mutateAsync(input));
        onClose();
      }}
    />
  );
}
