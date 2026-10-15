import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface FormFieldProps {
  label: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
  span?: 1 | 2 | 3;
  required?: boolean;
}

/** Label + control + error/hint – same look as the prototype "lbl" fields. */
export function FormField({ label, error, hint, children, span = 1, required }: FormFieldProps) {
  return (
    <label className={`lbl${span > 1 ? ` span-${span}` : ''}`}>
      <span>
        {label}
        {required && ' *'}
      </span>
      {children}
      {error ? <span className="field-err">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ invalid, className, ...rest }, ref) {
  return <input ref={ref} className={['inp', invalid && 'invalid', className].filter(Boolean).join(' ')} {...rest} />;
});

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { options: (SelectOption | string)[]; invalid?: boolean; placeholder?: string }>(
  function Select({ options, invalid, className, placeholder, ...rest }, ref) {
    return (
      <select ref={ref} className={['inp', invalid && 'invalid', className].filter(Boolean).join(' ')} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          );
        })}
      </select>
    );
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function TextArea({ invalid, className, ...rest }, ref) {
  return <textarea ref={ref} className={['inp', invalid && 'invalid', className].filter(Boolean).join(' ')} {...rest} />;
});

export function Checkbox({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
