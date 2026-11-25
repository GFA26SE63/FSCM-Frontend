import type { ReactNode } from 'react';

/** "Bộ lọc nâng cao" card — same markup/classes as the DataTable filter card (Batch Management reference). */
export function AdvancedFilterCard({ children, label = 'Bộ lọc nâng cao', as: Tag = 'section', ...rest }: {
  children: ReactNode; label?: string; as?: 'section' | 'form'; onSubmit?: React.FormEventHandler<HTMLFormElement>;
}) {
  return (
    <Tag className="card filter-card" aria-label={label} {...rest}>
      <div className="row">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14655B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 5h18l-7 8v6l-4 2v-8z" />
        </svg>
        <h2 className="sec">Bộ lọc nâng cao</h2>
      </div>
      <div className="filter-grid">{children}</div>
    </Tag>
  );
}
