import { FormDialog } from '@/shared/ui';
import { IdFormat } from '@/shared/lib';
import { useCreateWarehouse, useUpdateWarehouse } from '../hooks';
import type { Warehouse } from '../types';

export function WarehouseDialog({ open, warehouse, onClose }: { open: boolean; warehouse?: Warehouse | null; onClose: () => void }) {
  const create = useCreateWarehouse();
  const update = useUpdateWarehouse();
  const edit = !!warehouse;
  return (
    <FormDialog
      open={open}
      width={720}
      columns={3}
      title={edit ? `Sửa kho ${warehouse!.code}` : 'Thêm kho'}
      submitLabel={edit ? 'Lưu' : 'Thêm kho'}
      note="Khoảng cách tới retailer và giữa các kho tính từ toạ độ; thời gian vận chuyển theo bảng dùng chung ở Cấu hình hệ thống."
      initial={warehouse ? { ...warehouse } : { code: 'WH-', name: '', address: '', lat: '', lng: '', type: 'Regional', keeperName: '', capacityPallets: '', status: 'Active' }}
      fields={[
        { key: 'code', label: 'Mã kho', required: true, readOnly: edit, validate: (v) => (!IdFormat.isWarehouseCode(String(v)) ? 'Dạng WH-XX hoặc WH-XXX.' : undefined) },
        { key: 'name', label: 'Tên kho', required: true, span: 2 },
        { key: 'address', label: 'Địa chỉ', required: true, span: 3 },
        { key: 'lat', label: 'Vĩ độ', type: 'number', required: true },
        { key: 'lng', label: 'Kinh độ', type: 'number', required: true },
        { key: 'type', label: 'Loại kho', type: 'select', options: [{ value: 'Central', label: 'Kho tổng' }, { value: 'Regional', label: 'Kho vùng' }] },
        { key: 'keeperName', label: 'Thủ kho' },
        { key: 'capacityPallets', label: 'Sức chứa (pallet)', type: 'number' },
        { key: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'Active', label: 'Hoạt động' }, { value: 'Paused', label: 'Tạm ngừng' }] },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        const input = { code: v.code, name: v.name, address: v.address, lat: Number(v.lat), lng: Number(v.lng), type: v.type, keeperName: v.keeperName || null, capacityPallets: Number(v.capacityPallets) || 0, status: v.status };
        await (edit ? update : create).mutateAsync(input);
        onClose();
      }}
    />
  );
}
