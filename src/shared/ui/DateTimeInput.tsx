import { DateInput } from './DateInput';
import { Input } from './FormField';

/** Vietnam wall-clock value stays yyyy-mm-ddTHH:mm[:ss.SSS]; only the date display changes. */
export function DateTimeInput({ value, onChange, invalid, required, disabled, 'aria-label': label }: {
  value: string; onChange: (value: string) => void; invalid?: boolean;
  required?: boolean; disabled?: boolean; 'aria-label'?: string;
}) {
  const [date = '', time = ''] = value.split('T');
  return <div className="row-wrap" style={{ gap: 8 }}>
    <DateInput value={date} onChange={next => onChange(next ? `${next}T${time || '00:00'}` : '')}
      required={required} invalid={invalid} disabled={disabled} aria-label={label ? `${label} · Ngày` : 'Ngày'} />
    <Input type="time" step="0.001" value={time} disabled={disabled || !date} invalid={invalid}
      aria-label={label ? `${label} · Giờ` : 'Giờ'} style={{ width: 150 }}
      onChange={event => onChange(`${date}T${event.target.value}`)} />
  </div>;
}
