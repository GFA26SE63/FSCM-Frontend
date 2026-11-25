import { useRef, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { assertPermission } from '@/shared/auth/permissions';
import { errorMessage, toApiError } from '@/shared/api/errors';
import { Button, Callout, Card, DateTimeInput, FormField, Input, TextArea } from '@/shared/ui';
import { useCreateProgram } from '../hooks';
import { programInitial, programPayload, validateProgram, type ProgramFormValues } from '../programForm';
import type { ProgramRetailerOption } from '../types';
import { ProgramRetailerTable } from './ProgramRetailerTable';

export function ProgramCreateForm({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const create = useCreateProgram();
  const [values, setValues] = useState(programInitial);
  const [retailers, setRetailers] = useState<ProgramRetailerOption[]>([]);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const saving = useRef(false);
  const errors = { ...serverErrors, ...(tried ? validateProgram(values) : {}) };
  const set = (key: keyof ProgramFormValues, value: string | string[]) => {
    setValues(current => ({ ...current, [key]: value }));
    setServerErrors(current => { const next = { ...current }; delete next[key]; return next; });
  };
  async function submit() {
    if (saving.current) return;
    setTried(true);
    if (Object.keys(validateProgram(values)).length) return;
    saving.current = true;
    setFailure(''); setServerErrors({});
    try {
      assertPermission(user, 'loyalty.manage');
      await create.mutateAsync(programPayload(values));
      onClose();
    } catch (error) {
      const apiError = toApiError(error);
      setFailure(errorMessage(apiError));
      setServerErrors(Object.fromEntries(Object.keys(values).flatMap(key => {
        const message = apiError.field(key); return message ? [[key, message]] : [];
      })));
    } finally { saving.current = false; }
  }
  return <>
    {failure && <Callout tone="danger">{failure}</Callout>}
    {tried && Object.keys(validateProgram(values)).length > 0 && <Callout tone="danger">Kiểm tra các trường chưa hợp lệ bên dưới.</Callout>}
    <Card title="Thông tin chương trình">
      <div className="form-grid cols-2">
        <FormField label="Tên chương trình" required span={2} error={errors.name}>
          <Input value={values.name} maxLength={200} disabled={create.isPending} onChange={e => set('name', e.target.value)} />
        </FormField>
        <FormField label="Mô tả" span={2} error={errors.description}><TextArea value={values.description} disabled={create.isPending}
          onChange={e => set('description', e.target.value)} /></FormField>
        <FormField label="Số tiền quy đổi 1 điểm (đồng)" required error={errors.spendAmountPerPoint}>
          <Input inputMode="decimal" value={values.spendAmountPerPoint} disabled={create.isPending}
            onChange={e => set('spendAmountPerPoint', e.target.value)} />
        </FormField>
        <FormField label="Điểm tối thiểu đổi quà" required error={errors.minimumRedeemPoints}>
          <Input inputMode="numeric" value={values.minimumRedeemPoints} disabled={create.isPending}
            onChange={e => set('minimumRedeemPoints', e.target.value)} />
        </FormField>
        {(['startAt', 'endAt'] as const).map(key => {
          const label = key === 'startAt' ? 'Hiệu lực từ (giờ Việt Nam)' : 'Hiệu lực đến (giờ Việt Nam)';
          return <FormField key={key} label={label} required error={errors[key]}
            hint="Ngày theo dd/mm/yyyy, giờ Việt Nam (UTC+7).">
            <DateTimeInput value={values[key]} onChange={value => set(key, value)} invalid={!!errors[key]}
              disabled={create.isPending} aria-label={label} />
          </FormField>;
        })}
      </div>
    </Card>
    <ProgramRetailerTable value={retailers} onChange={rows => { setRetailers(rows); set('retailerIds', rows.map(r => r.id)); }}
      error={errors.retailerIds} disabled={create.isPending} />
    <Callout>Chương trình mới chưa được kích hoạt. Quy đổi điểm làm tròn xuống theo máy chủ.</Callout>
    <div className="row-wrap" style={{ justifyContent: 'flex-end', gap: 8 }}>
      <Button disabled={create.isPending} onClick={onClose}>Hủy</Button>
      <Button variant="primary" loading={create.isPending} onClick={() => void submit()}>Tạo chương trình</Button>
    </div>
  </>;
}
