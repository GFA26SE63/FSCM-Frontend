import type { ReactNode } from 'react';

export function Stat({ label, value, note, color }: { label: string; value: ReactNode; note?: ReactNode; color?: string }) {
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>
        {value}
      </div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}
