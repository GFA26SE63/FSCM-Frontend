import type { ReactNode } from 'react';
import './ExpandableRecord.css';

/** A compact record header with a full-width, initially collapsed detail panel. */
export function ExpandableRecord({ title, subtitle, meta, actionLabel = 'Xem chi tiết', children }: {
  title: ReactNode; subtitle?: ReactNode; meta?: ReactNode; actionLabel?: string; children: ReactNode;
}) {
  return <details className="expandable-record">
    <summary className="expandable-record__summary">
      <span className="expandable-record__identity"><strong>{title}</strong>{subtitle && <span className="expandable-record__subtitle">{subtitle}</span>}</span>
      {meta && <span className="expandable-record__meta">{meta}</span>}
      <span className="expandable-record__action">{actionLabel} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
    </summary>
    <div className="expandable-record__body">{children}</div>
  </details>;
}
