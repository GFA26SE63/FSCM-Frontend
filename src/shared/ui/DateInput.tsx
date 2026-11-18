import { useEffect, useRef, useState } from 'react';

/** "2026-11-18" → "18/11/2026"; anything else → "". */
export function isoToVnDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** "18/11/2026" → "2026-11-18"; "" → ""; incomplete or impossible dates → null. */
export function vnToIsoDate(text: string): string | null {
  const value = text.trim();
  if (value === '') return '';
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Keeps digits and inserts the slashes while typing: "18112026" → "18/11/2026". */
export function maskVnDate(text: string): string {
  if (text.includes('/')) return text.replace(/[^\d/]/g, '').slice(0, 10);
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}

interface DateInputProps {
  /** ISO date `yyyy-mm-dd` or "". */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * Date field shown as dd/mm/yyyy whatever the browser locale (a native `type="date"` follows
 * the OS and shows mm/dd/yyyy on en-US machines). The value stays ISO for the API; the
 * calendar button opens the native picker.
 */
export function DateInput({ value, onChange, min, max, required, invalid, disabled, ...rest }: DateInputProps) {
  const [text, setText] = useState(isoToVnDate(value));
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => { setText(isoToVnDate(value)); }, [value]);
  const iso = vnToIsoDate(text);
  const outOfRange = !!iso && ((!!min && iso < min) || (!!max && iso > max));
  return (
    <div className="date-input">
      <input
        className={['inp', (invalid || iso === null || outOfRange) && 'invalid'].filter(Boolean).join(' ')}
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={text}
        required={required}
        disabled={disabled}
        aria-label={rest['aria-label']}
        onChange={(e) => {
          const next = maskVnDate(e.target.value);
          setText(next);
          const parsed = vnToIsoDate(next);
          if (parsed !== null && parsed !== value) onChange(parsed);
        }}
        onBlur={() => setText(isoToVnDate(value))}
      />
      <button
        type="button"
        className="date-input-btn"
        aria-label="Chọn ngày"
        disabled={disabled}
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          try { el.showPicker(); } catch { el.focus(); el.click(); }
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      </button>
      <input
        ref={picker}
        type="date"
        className="date-input-native"
        tabIndex={-1}
        aria-hidden
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
