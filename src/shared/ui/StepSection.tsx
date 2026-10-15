import type { ReactNode } from 'react';

/** Numbered step block used by the allocation trace (B1–B4) and rotation trace (Bước 1–4). */
export function StepSection({ num, title, hint, note, children }: { num: string; title: ReactNode; hint?: ReactNode; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="step">
      <div className="step-hd">
        <span className="step-num">{num}</span>
        <span className="step-title">{title}</span>
        {hint && <span className="step-hint">{hint}</span>}
      </div>
      {note && <div className="step-note">{note}</div>}
      {children}
    </div>
  );
}
