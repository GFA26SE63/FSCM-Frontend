import type { ReactNode } from 'react';

export interface SimpleColumn<T> {
  header: string;
  cell: (row: T, index: number) => ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
}

/** Small non-paged table for detail screens, trace steps, dialogs. */
export function SimpleTable<T>({ columns, rows, empty = 'Không có dữ liệu.', compact }: { columns: SimpleColumn<T>[]; rows: T[]; empty?: string; compact?: boolean }) {
  return (
    <div className="tbl-wrap">
      <table className={`tbl${compact ? ' compact' : ''}`}>
        <colgroup>
          {columns.map((c, i) => (
            <col key={i} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{ textAlign: c.align ?? 'left' }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {columns.map((c, ci) => (
                <td key={ci} style={{ textAlign: c.align ?? 'left' }}>
                  {c.cell(r, ri)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="muted" style={{ margin: '10px 14px' }}>{empty}</p>}
    </div>
  );
}
