import { useId, type ReactNode } from 'react';

export function ToggleSwitch({ label, checked, onChange, disabled = false }: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const labelId = useId();
  return <div className="toggle-switch">
    <button type="button" role="switch" aria-checked={checked} aria-labelledby={labelId}
      disabled={disabled} className="toggle-switch-control" onClick={() => onChange(!checked)}>
      <span className="toggle-switch-thumb" />
    </button>
    <span id={labelId} className="toggle-switch-label">{label}</span>
    <span className="toggle-switch-state" aria-hidden="true">{checked ? 'Bật' : 'Tắt'}</span>
  </div>;
}
