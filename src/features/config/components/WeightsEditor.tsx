import { FormField, Input } from '@/shared/ui';
import { formatNumber } from '@/shared/lib';
import type { Weights } from '../types';

const keys: { k: keyof Weights; label: string }[] = [
  { k: 'wE', label: 'wE – HSD còn lại' },
  { k: 'wD', label: 'wD – khoảng cách' },
  { k: 'wQ', label: 'wQ – số lượng' },
];

/** Three weights that must add up to 1. Values are kept as strings while typing. */
export function WeightsEditor({ value, onChange }: { value: Record<keyof Weights, string>; onChange: (v: Record<keyof Weights, string>) => void }) {
  const sum = keys.reduce((a, { k }) => a + (Number(value[k]) || 0), 0);
  const ok = Math.abs(sum - 1) < 0.001;
  return (
    <div className="form-grid">
      {keys.map(({ k, label }) => (
        <FormField key={k} label={label} error={Number.isNaN(Number(value[k])) || value[k] === '' ? 'Phải là số.' : null}>
          <Input inputMode="decimal" value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value.replace(',', '.') })} />
        </FormField>
      ))}
      <span className={ok ? 'muted small' : 'field-err'} style={{ gridColumn: '1 / -1' }}>
        Tổng = {formatNumber(sum, 2)} {ok ? '(hợp lệ)' : '– phải bằng 1.'}
      </span>
    </div>
  );
}
