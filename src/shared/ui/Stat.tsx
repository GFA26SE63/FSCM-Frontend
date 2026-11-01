import type { ReactNode } from 'react';

export function Stat({
  label,
  value,
  note,
  color,
  onClick,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  color?: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      className="card stat"
      onClick={onClick}
      style={{ textAlign: 'left', cursor: onClick ? 'pointer' : undefined, fontFamily: 'inherit', color: 'inherit', border: 'none' }}
    >
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>
        {value}
      </div>
      {note && <div className="stat-note">{note}</div>}
    </Comp>
  );
}
