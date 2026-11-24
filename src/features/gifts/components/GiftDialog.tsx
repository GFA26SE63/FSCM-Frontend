import { Callout, FormDialog } from '@/shared/ui';
import type { Gift, GiftInput, GiftProgram } from '../types';
import { GiftImagePicker } from './GiftImagePicker';

interface Props {
  gift: Gift | null;
  programs: GiftProgram[];
  statusError: string;
  imageFile?: File | null;
  targetStatus?: Gift['status'];
  onClose: () => void;
  onSubmit: (input: GiftInput) => Promise<void>;
}
const integer = (value: unknown, minimum: number) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= 2147483647
    ? undefined : `Nhập số nguyên từ ${minimum} đến 2147483647.`;
};

export function GiftDialog({ gift, programs, statusError, imageFile, targetStatus, onClose, onSubmit }: Props) {
  return <FormDialog
    open width={560} columns={2}
    title={gift ? `Sửa quà ${gift.code}` : 'Thêm quà'}
    submitLabel="Lưu quà"
    initial={{ name: gift?.name ?? '', description: gift?.description ?? '', imageUrl: gift?.imageUrl ?? '', imageFile: imageFile ?? null,
      points: gift?.points ?? '', stock: gift?.stock ?? '', unlimited: gift ? gift.stock === null : false,
      status: targetStatus ?? gift?.status ?? 'Active', loyaltyProgramId: gift?.loyaltyProgramId ?? '' }}
    note={statusError ? <Callout tone="warn">{statusError} Quà đã tồn tại; lưu lại sẽ cập nhật quà này.</Callout>
      : 'Điểm và lượng quà được giữ khi nhà bán lẻ gửi yêu cầu; từ chối sẽ trả lại phần đã giữ.'}
    fields={[
      gift ? { key: 'program', type: 'info', label: 'Chương trình khách hàng thân thiết', span: 2,
        info: () => { const p = programs.find(item => item.id === gift.loyaltyProgramId); return p ? `${p.code} · ${p.name}` : gift.loyaltyProgramId; } }
        : { key: 'loyaltyProgramId', type: 'select', label: 'Chương trình khách hàng thân thiết', required: true, span: 2,
          options: [{ value: '', label: 'Chọn chương trình khách hàng thân thiết', disabled: true },
            ...programs.map(p => ({ value: p.id, label: `${p.code} · ${p.name}` }))] },
      { key: 'name', label: 'Tên quà', required: true, span: 2,
        validate: value => String(value).trim().length < 2 || String(value).trim().length > 200 ? 'Tên quà từ 2 đến 200 ký tự.' : undefined },
      { key: 'description', label: 'Mô tả', type: 'textarea', span: 2 },
      { key: 'imageFile', label: 'Ảnh quà', type: 'custom', span: 2,
        render: (values, set) => <GiftImagePicker file={values.imageFile ?? null} imageUrl={values.imageUrl || ''}
          onFile={file => set('imageFile', file)} onUrl={url => set('imageUrl', url)} /> },
      { key: 'points', label: 'Điểm đổi cho 1 quà', type: 'number', required: true, validate: value => integer(value, 1) },
      { key: 'status', label: 'Trạng thái', type: 'select', required: true,
        options: [{ value: 'Active', label: 'Hoạt động' }, { value: 'Paused', label: 'Tạm ngừng' }] },
      { key: 'unlimited', label: 'Không giới hạn số lượng quà', type: 'check', span: 2 },
      { key: 'stock', label: 'Số quà còn có thể cấp', type: 'number', required: true,
        visible: values => !values.unlimited, validate: value => integer(value, 0) },
    ]}
    onClose={onClose}
    onSubmit={async values => onSubmit({
      name: String(values.name), description: values.description || null,
      imageUrl: gift && values.imageUrl === gift.imageUrl ? (gift.imageReference ?? gift.imageUrl) : values.imageUrl || null,
      imageFile: values.imageFile ?? null,
      points: Number(values.points), stock: values.unlimited ? null : Number(values.stock),
      status: values.status, loyaltyProgramId: gift?.loyaltyProgramId ?? values.loyaltyProgramId,
      rewardType: gift?.rewardType ?? 'Physical', discountAmount: gift?.discountAmount ?? null, discountPercent: gift?.discountPercent ?? null,
    })}
  />;
}
