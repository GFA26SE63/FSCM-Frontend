import { FormDialog } from '@/shared/ui';
import { IdFormat } from '@/shared/lib';
import { useAreas, useCreateArea, useCreateGroup, useGroups, useStaff, useTransferStaff, useUpdateGroup } from '../hooks';
import type { SalesGroup } from '../types';

export function AreaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateArea();
  return (
    <FormDialog
      open={open}
      width={560}
      title="Thêm khu vực"
      submitLabel="Thêm khu vực"
      initial={{ code: '', name: '', region: 'Miền Nam', managerName: 'Hồ Gia Bảo' }}
      fields={[
        { key: 'code', label: 'Mã khu vực', required: true, placeholder: 'Q12' },
        { key: 'name', label: 'Tên khu vực', required: true },
        { key: 'region', label: 'Vùng', type: 'select', options: ['Miền Nam', 'Miền Trung', 'Miền Bắc'] },
        { key: 'managerName', label: 'Sales Manager' },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        await create.mutateAsync({ code: v.code, name: v.name, region: v.region, managerName: v.managerName });
        onClose();
      }}
    />
  );
}

/** Create / edit a Sales group. A Sales belongs to exactly one group – picking someone moves them from their old group. */
export function GroupDialog({ open, group, onClose }: { open: boolean; group?: SalesGroup | null; onClose: () => void }) {
  const areas = useAreas();
  const staff = useStaff();
  const create = useCreateGroup();
  const update = useUpdateGroup();
  if (!open || !areas.data || !staff.data) return null;
  const edit = !!group;
  return (
    <FormDialog
      open
      width={620}
      title={edit ? `Sửa nhóm ${group!.code}` : 'Thêm nhóm Sales'}
      submitLabel={edit ? 'Lưu' : 'Thêm nhóm'}
      note="Mỗi Sales chỉ thuộc một nhóm; chọn Sales đang ở nhóm khác sẽ chuyển họ sang nhóm này."
      initial={group ? { ...group } : { code: '', areaCode: areas.data[0]?.code ?? '', managerName: 'Hồ Gia Bảo', members: [] }}
      fields={[
        { key: 'code', label: 'Mã nhóm', required: true, readOnly: edit, placeholder: 'Q12-C', validate: (v) => (!IdFormat.isAreaGroup(String(v)) ? 'Dạng KHU-X, ví dụ Q12-C.' : undefined) },
        { key: 'areaCode', label: 'Khu vực', type: 'select', options: areas.data.map((a) => ({ value: a.code, label: a.name })) },
        { key: 'managerName', label: 'Sales Manager' },
        { key: 'members', label: 'Sales trong nhóm', type: 'chips', required: true, span: 3, options: staff.data.map((s) => ({ value: s.name, label: s.groupCode && s.groupCode !== group?.code ? `${s.name} (đang ở ${s.groupCode})` : s.name })) },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        const input = { code: v.code, areaCode: v.areaCode, managerName: v.managerName, members: v.members as string[] };
        await (edit ? update : create).mutateAsync(input);
        onClose();
      }}
    />
  );
}

export function TransferStaffDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const staff = useStaff();
  const groups = useGroups();
  const transfer = useTransferStaff();
  if (!open || !staff.data || !groups.data) return null;
  return (
    <FormDialog
      open
      width={560}
      columns={1}
      title="Chuyển Sales sang nhóm khác"
      submitLabel="Chuyển nhóm"
      initial={{ name: staff.data[0]?.name ?? '', toGroup: groups.data[0]?.code ?? '', effectiveDate: '' }}
      fields={[
        { key: 'name', label: 'Sales', type: 'select', required: true, options: staff.data.map((s) => ({ value: s.name, label: `${s.name} (${s.groupCode ?? 'chưa có nhóm'})` })) },
        { key: 'toGroup', label: 'Nhóm đích', type: 'select', required: true, options: groups.data.map((g) => ({ value: g.code, label: `${g.code} · ${g.areaName}` })) },
        { key: 'effectiveDate', label: 'Ngày hiệu lực', type: 'date' },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        await transfer.mutateAsync({ name: v.name, toGroup: v.toGroup, effectiveDate: v.effectiveDate || undefined });
        onClose();
      }}
    />
  );
}
