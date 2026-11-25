import { useAuth } from '@/shared/auth/AuthContext';
import { assertPermission } from '@/shared/auth/permissions';
import { DateTimeInput, FormDialog, FormField, type FormFieldDef } from '@/shared/ui';
import { useCreateProgram, useProgramRetailers, useUpdateProgram } from '../hooks';
import { programInitial, programPayload, validateProgram, type ProgramFormValues } from '../programForm';
import type { LoyaltyProgram } from '../types';
import { ProgramRetailerPicker } from './ProgramRetailerPicker';

interface Props { program?: LoyaltyProgram; onClose: () => void }

export function ProgramDialog({ program, onClose }: Props) {
  const { user } = useAuth();
  const create = useCreateProgram();
  const update = useUpdateProgram();
  const retailers = useProgramRetailers();
  const validate = (key: keyof ProgramFormValues): FormFieldDef['validate'] =>
    (_, values) => {
      const errors = validateProgram(values as ProgramFormValues);
      return errors[key] ?? (key === 'endAt' ? errors.pointsExpireAt : undefined);
    };
  const fields: FormFieldDef[] = [
    { key: 'name', label: 'Tên chương trình', required: true, span: 2, validate: validate('name') },
    { key: 'description', label: 'Mô tả', type: 'textarea', span: 2 },
    { key: 'spendAmountPerPoint', label: 'Số tiền quy đổi 1 điểm (đồng)', type: 'number',
      required: true, validate: validate('spendAmountPerPoint') },
    { key: 'minimumRedeemPoints', label: 'Điểm tối thiểu đổi quà', type: 'number',
      required: true, validate: validate('minimumRedeemPoints') },
    ...(['startAt', 'endAt'] as const).map(key => {
      const label = key === 'startAt' ? 'Hiệu lực từ (giờ Việt Nam)' : 'Hiệu lực đến (giờ Việt Nam)';
      return { key, label, type: 'custom' as const, validate: validate(key),
        render: (values: Record<string, string>, set: (key: string, value: unknown) => void, error?: string) =>
          <FormField label={label} required error={error}>
            <DateTimeInput value={values[key] ?? ''} onChange={value => set(key, value)} invalid={!!error} aria-label={label} />
          </FormField> };
    }),
    { key: 'retailerIds', label: 'Nhà bán lẻ áp dụng', type: 'custom', span: 2,
      validate: validate('retailerIds'),
      render: (values, set, error) => <ProgramRetailerPicker value={values.retailerIds}
        onChange={(ids) => set('retailerIds', ids)} options={retailers.data}
        loading={retailers.isLoading} error={retailers.error}
        onRetry={() => void retailers.refetch()} validationError={error} /> },
  ];

  return <FormDialog open width={780} title={program ? `Sửa chương trình ${program.code}` : 'Tạo chương trình tích điểm'}
    subtitle="Ngày giờ nhập theo Việt Nam (UTC+7)."
    submitLabel={program ? 'Lưu thay đổi' : 'Tạo chương trình'}
    initial={programInitial(program)} fields={fields}
    note="Chương trình mới chưa được kích hoạt. Quy đổi điểm làm tròn xuống theo máy chủ."
    onClose={onClose}
    onSubmit={async (values) => {
      assertPermission(user, 'loyalty.manage');
      const payload = programPayload(values as ProgramFormValues, program);
      if (program) await update.mutateAsync({ ...payload, id: program.id });
      else await create.mutateAsync(payload);
      onClose();
    }} />;
}
