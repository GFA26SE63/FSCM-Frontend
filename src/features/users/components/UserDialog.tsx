import { FormDialog, type FormFieldDef } from '@/shared/ui';
import { IdFormat } from '@/shared/lib';
import { useCreateUser, useUserLookups } from '../hooks';
import type { CreatableRole } from '../types';

export const roleOptions: { value: CreatableRole; label: string }[] = [
  { value: 'Operator', label: 'Operator (Portal)' },
  { value: 'SalesManager', label: 'Sales Manager (Portal)' },
  { value: 'WarehouseKeeper', label: 'Warehouse Keeper (Portal)' },
  { value: 'Sales', label: 'Sales (App)' },
  { value: 'Retailer', label: 'Retailer (App)' },
];

/** Create account – Admin is intentionally not offered (provisioned at installation). Operator / Sales Manager sign in by email, app roles by phone. */
export function UserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lookups = useUserLookups(open);
  const create = useCreateUser();
  if (!open || !lookups.warehouses.data || !lookups.groups.data || !lookups.retailers.data) return null;
  const emailRoles = ['Operator', 'SalesManager'];
  const fields: FormFieldDef[] = [
    { key: 'role', label: 'Vai trò', type: 'select', required: true, options: roleOptions },
    { key: 'name', label: 'Họ tên', required: true },
    { key: 'email', label: 'Email (tài khoản đăng nhập)', required: true, visible: (v) => emailRoles.includes(v.role), validate: (v) => (!/^\S+@\S+\.\S+$/.test(String(v)) ? 'Email không hợp lệ.' : undefined) },
    { key: 'phone', label: 'Số điện thoại (tài khoản đăng nhập)', required: true, visible: (v) => !emailRoles.includes(v.role) && v.role !== 'WarehouseKeeper', validate: (v) => (!IdFormat.isPhone(String(v)) ? 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.' : undefined) },
    { key: 'email', label: 'Email Microsoft (Entra ID)', required: true, visible: (v) => v.role === 'WarehouseKeeper' },
    { key: 'warehouseCode', label: 'Kho phụ trách', type: 'select', required: true, visible: (v) => v.role === 'WarehouseKeeper', options: lookups.warehouses.data.map((w) => ({ value: w.code, label: w.name })) },
    { key: 'groupCode', label: 'Nhóm Sales', type: 'select', required: true, visible: (v) => v.role === 'Sales', options: lookups.groups.data.map((g) => ({ value: g.code, label: g.name })) },
    { key: 'retailerCode', label: 'Retailer', type: 'select', required: true, visible: (v) => v.role === 'Retailer', options: lookups.retailers.data.map((r) => ({ value: r.code, label: `${r.code} · ${r.name}` })) },
  ];
  return (
    <FormDialog
      open
      width={620}
      columns={1}
      title="Tạo tài khoản"
      submitLabel="Tạo tài khoản"
      note="Không tạo tài khoản Admin trên Portal – Admin được tạo sẵn khi cài đặt hệ thống."
      initial={{ role: 'Operator', name: '', email: '', phone: '', warehouseCode: lookups.warehouses.data[0]?.code ?? '', groupCode: lookups.groups.data[0]?.code ?? '', retailerCode: lookups.retailers.data[0]?.code ?? '' }}
      fields={fields}
      onClose={onClose}
      onSubmit={async (v) => {
        await create.mutateAsync({ role: v.role, name: v.name, email: v.email, phone: v.phone, warehouseCode: v.warehouseCode, groupCode: v.groupCode, retailerCode: v.retailerCode });
        onClose();
      }}
    />
  );
}
