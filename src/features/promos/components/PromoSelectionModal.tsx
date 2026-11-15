import { useState } from 'react';
import { Button, DataTable, Modal, type Column } from '@/shared/ui';

interface Props<T extends { id: string }> {
  title: string;
  rows: T[] | undefined;
  columns: Column<T>[];
  selectedIds: string[];
  rowLabel: (row: T) => string;
  searchPlaceholder: string;
  loading?: boolean;
  error?: unknown;
  onApply: (ids: string[]) => void;
  onCancel: () => void;
}

/** Mounted afresh for each Add action; Cancel/Escape/backdrop never commit the draft. */
export function PromoSelectionModal<T extends { id: string }>({
  title, rows, columns, selectedIds, rowLabel, searchPlaceholder, loading, error, onApply, onCancel,
}: Props<T>) {
  const [draft, setDraft] = useState(() => [...new Set(selectedIds)]);
  return <Modal open title={title} width={1100} onClose={onCancel}
    subtitle={`Đã chọn ${draft.length}. Chỉ cập nhật danh sách sau khi nhấn Apply.`}
    footer={<><Button onClick={onCancel}>Cancel</Button>
      <Button variant="primary" disabled={loading || !!error || rows === undefined} onClick={() => onApply(draft)}>Apply</Button></>}>
    <DataTable urlState={false} title="Tìm kiếm và chọn" rows={rows} loading={loading} error={error}
      rowKey={row => row.id} pageSize={5} searchPlaceholder={searchPlaceholder}
      emptyText="Không tìm thấy mục phù hợp."
      columns={[{ key: 'select', header: 'Chọn', width: '80px',
        render: row => <label className="check"><input type="checkbox" aria-label={`Chọn ${rowLabel(row)}`}
          checked={draft.includes(row.id)} onChange={event => setDraft(ids => event.target.checked
            ? ids.includes(row.id) ? ids : [...ids, row.id]
            : ids.filter(id => id !== row.id))} /></label> }, ...columns]} />
  </Modal>;
}
