import { useState } from 'react';
import { Button, Checkbox, Input } from '@/shared/ui';
import { errorMessage } from '@/shared/api/errors';
import type { ProgramRetailerOption } from '../types';

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
  options: ProgramRetailerOption[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  validationError?: string;
}

export function ProgramRetailerPicker({ value, onChange, options, loading, error, onRetry, validationError }: Props) {
  const [search, setSearch] = useState('');
  const selected = new Set(value);
  const filtered = (options ?? []).filter((r) =>
    `${r.code} ${r.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  const unknown = value.filter((id) => options && !options.some((r) => r.id === id));

  return (
    <div>
      <p className="bold">Retailer áp dụng * · Đã chọn {value.length}</p>
      <Input aria-label="Tìm retailer áp dụng" placeholder="Tìm mã hoặc tên retailer…"
        value={search} onChange={(e) => setSearch(e.target.value)} />
      {loading && <p>Đang tải danh sách retailer…</p>}
      {error != null && <div className="callout callout-danger">
        {errorMessage(error)} <Button size="sm" onClick={onRetry}>Tải lại retailer</Button>
      </div>}
      {!loading && !error && options && <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8 }}>
        {filtered.length === 0 && <p>Không có retailer phù hợp.</p>}
        {filtered.map((r) => <div key={r.id} style={{ padding: '6px 0' }}>
          <Checkbox label={`${r.code} · ${r.name} (${r.status})`}
            checked={selected.has(r.id)}
            onChange={(checked) => onChange(checked
              ? [...value, r.id] : value.filter((id) => id !== r.id))} />
        </div>)}
      </div>}
      {unknown.length > 0 && <div className="callout callout-info">
        <p>Một số retailer đã chọn không còn trong danh sách hiện tại. Lựa chọn được giữ để bạn kiểm tra.</p>
        {unknown.map((id) => <Checkbox key={id} label={id} checked
          onChange={() => onChange(value.filter((item) => item !== id))} />)}
      </div>}
      {validationError && <p className="field-err">{validationError}</p>}
    </div>
  );
}
