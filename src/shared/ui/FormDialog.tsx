import { useEffect, useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Checkbox, FormField, Input, Select, TextArea, type SelectOption } from './FormField';
import { toApiError } from '../api/errors';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormValues = Record<string, any>;

export interface FormFieldDef {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'datetime-local' | 'select' | 'textarea' | 'check' | 'chips' | 'info';
  required?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  span?: 1 | 2 | 3;
  options?: (string | SelectOption)[];
  readOnly?: boolean;
  /** Return a message to flag the value as invalid (only called when the field has a value). */
  validate?: (value: unknown, values: FormValues) => string | undefined | false;
  /** Read-only computed text for type "info". */
  info?: (values: FormValues) => ReactNode;
  visible?: (values: FormValues) => boolean;
}

interface FormDialogProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  fields: FormFieldDef[];
  initial: FormValues;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (values: FormValues) => Promise<unknown> | void;
  note?: ReactNode;
  danger?: boolean;
  width?: number;
  columns?: 1 | 2 | 3;
}

const isEmpty = (v: unknown) => v === undefined || v === null || String(v).trim() === '' || (Array.isArray(v) && v.length === 0);

/**
 * Schema-driven form in a modal – required / number validation with the prototype wording
 * ("Bắt buộc nhập.", "Phải là số."), server field errors (ProblemDetails.errors) mapped back to fields.
 */
export function FormDialog({ open, title, subtitle, fields, initial, submitLabel, onClose, onSubmit, note, danger, width = 720, columns = 2 }: FormDialogProps) {
  const [values, setValues] = useState<FormValues>(initial);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues(initial);
      setTried(false);
      setServerErrors({});
      setGeneralError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const visibleFields = fields.filter((f) => !f.visible || f.visible(values));
  const errorOf = (f: FormFieldDef): string | undefined => {
    if (f.type === 'info' || f.type === 'check') return undefined;
    const v = values[f.key];
    if (f.required && isEmpty(v)) return 'Bắt buộc nhập.';
    if (isEmpty(v)) return undefined;
    if (f.type === 'number' && Number.isNaN(Number(String(v).replace(',', '.')))) return 'Phải là số.';
    return f.validate?.(v, values) || undefined;
  };
  const errors = Object.fromEntries(visibleFields.map((f) => [f.key, errorOf(f)]));
  const errCount = Object.values(errors).filter(Boolean).length;

  const set = (key: string, v: unknown) => setValues((s) => ({ ...s, [key]: v }));

  const submit = async () => {
    setTried(true);
    if (errCount > 0) return;
    setBusy(true);
    setGeneralError(null);
    try {
      const out: FormValues = { ...values };
      fields.forEach((f) => {
        if (f.type === 'number' && !isEmpty(out[f.key])) out[f.key] = Number(String(out[f.key]).replace(',', '.'));
      });
      await onSubmit(out);
    } catch (e) {
      const err = toApiError(e);
      const fe: Record<string, string> = {};
      fields.forEach((f) => {
        const m = err.field(f.key);
        if (m) fe[f.key] = m;
      });
      setServerErrors(fe);
      setGeneralError(Object.keys(fe).length ? null : err.detail ?? err.title);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      width={width}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant={danger ? 'danger-solid' : 'primary'} loading={busy} onClick={submit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      {tried && errCount > 0 && <div className="callout callout-danger">Còn {errCount} trường chưa hợp lệ – kiểm tra các ô báo đỏ bên dưới.</div>}
      {generalError && <div className="callout callout-danger">{generalError}</div>}
      <div className={`form-grid${columns === 2 ? ' cols-2' : ''}`} style={columns === 1 ? { gridTemplateColumns: '1fr' } : undefined}>
        {visibleFields.map((f) => {
          const err = (tried || serverErrors[f.key] ? errors[f.key] : undefined) ?? serverErrors[f.key];
          const span = Math.min(f.span ?? 1, columns) as 1 | 2 | 3;
          const type = f.type ?? 'text';
          if (type === 'info')
            return (
              <div key={f.key} className={`fv${span > 1 ? ` span-${span}` : ''}`}>
                <span className="fl">{f.label}</span>
                <span className="fval" style={{ borderBottomColor: 'var(--c-border)', color: 'var(--c-text-2)' }}>
                  {f.info ? f.info(values) : String(values[f.key] ?? '—')}
                </span>
              </div>
            );
          if (type === 'check')
            return (
              <div key={f.key} className={span > 1 ? `span-${span}` : undefined} style={{ paddingTop: 18 }}>
                <Checkbox label={f.label} checked={!!values[f.key]} onChange={(v) => set(f.key, v)} />
              </div>
            );
          if (type === 'chips') {
            const opts = (f.options ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
            const cur: string[] = values[f.key] ?? [];
            return (
              <div key={f.key} className={`lbl${span > 1 ? ` span-${span}` : ''}`}>
                <span>{f.label}{f.required && ' *'}</span>
                <div className="row-wrap" style={{ marginTop: 2 }}>
                  {opts.map((o) => {
                    const on = cur.includes(o.value);
                    return (
                      <button key={o.value} type="button" className={`pill${on ? ' active' : ''}`} style={{ height: 32 }} onClick={() => set(f.key, on ? cur.filter((x) => x !== o.value) : [...cur, o.value])}>
                        {on ? '✓ ' : ''}
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                {err ? <span className="field-err">{err}</span> : f.hint ? <span className="field-hint">{f.hint}</span> : null}
              </div>
            );
          }
          return (
            <FormField key={f.key} label={f.label} required={f.required} error={err} hint={f.hint} span={span}>
              {type === 'select' ? (
                <Select value={values[f.key] ?? ''} options={f.options ?? []} invalid={!!err} disabled={f.readOnly} onChange={(e) => set(f.key, e.target.value)} />
              ) : type === 'textarea' ? (
                <TextArea value={values[f.key] ?? ''} placeholder={f.placeholder} invalid={!!err} readOnly={f.readOnly} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <Input
                  type={type === 'number' ? 'text' : type}
                  inputMode={type === 'number' ? 'decimal' : undefined}
                  value={values[f.key] ?? ''}
                  placeholder={f.placeholder}
                  invalid={!!err}
                  readOnly={f.readOnly}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </FormField>
          );
        })}
      </div>
      {note && <p className="note">{note}</p>}
    </Modal>
  );
}
