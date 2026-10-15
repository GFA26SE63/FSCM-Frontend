import type { ReactNode } from 'react';

export interface FieldItem {
  label: string;
  value: ReactNode;
}

/** Read-only label/value grid (prototype "fv / fl / fval"). */
export function Fields({ items, cols = 2 }: { items: FieldItem[]; cols?: 2 | 3 }) {
  return (
    <div className={`fields${cols === 3 ? ' cols-3' : ''}`}>
      {items.map((f) => (
        <div className="fv" key={f.label}>
          <span className="fl">{f.label}</span>
          <span className="fval">{f.value ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}
