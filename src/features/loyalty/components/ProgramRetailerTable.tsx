import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthContext';
import { Button, Card, Checkbox, DataTable, type Column } from '@/shared/ui';
import { statusLabel } from '@/shared/lib/status';
import { loyaltyApi } from '../api';
import type { ProgramRetailerOption } from '../types';

const columns: Column<ProgramRetailerOption>[] = [
  { key: 'code', header: 'Mã cửa hàng', width: '130px' },
  { key: 'name', header: 'Tên cửa hàng', width: '220px' },
  { key: 'contactName', header: 'Người liên hệ', width: '170px', text: r => r.contactName || '—' },
  { key: 'phone', header: 'Số điện thoại', width: '140px', text: r => r.phone || '—' },
  { key: 'email', header: 'Email', width: '220px', text: r => r.email || '—' },
  { key: 'address', header: 'Địa chỉ', width: '260px', text: r => r.address || '—' },
  { key: 'status', header: 'Trạng thái', width: '130px', text: r => statusLabel('retailer', r.status) },
];

export function ProgramRetailerTable({ value, onChange, error, disabled }: {
  value: ProgramRetailerOption[]; onChange: (rows: ProgramRetailerOption[]) => void; error?: string; disabled?: boolean;
}) {
  const { user } = useAuth();
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: ['loyalty', 'program-retailer-page', user?.id, 'Active', page, search],
    queryFn: () => loyaltyApi.programRetailersPage(page, search), enabled: user?.role === 'Admin' && !selectedOnly });
  const selectionColumns: Column<ProgramRetailerOption>[] = [{
    key: 'select', header: 'Chọn', width: '65px', render: row => <input type="checkbox"
      aria-label={`Chọn ${row.code} · ${row.name}`} checked={value.some(item => item.id === row.id)}
      disabled={disabled || (!selectedOnly && (query.isFetching || !!query.error))}
      onChange={event => {
        if (disabled) return;
        onChange(event.target.checked
          ? [...value.filter(item => item.id !== row.id), row]
          : value.filter(item => item.id !== row.id));
      }} />,
  }, ...columns];
  return <Card title="Nhà bán lẻ áp dụng">
    <p>Chọn ít nhất một nhà bán lẻ. Lựa chọn được lưu cùng chương trình khi nhấn Tạo chương trình.</p>
    <div className="row-wrap" style={{ gap: 16, marginBottom: 12 }}>
      <strong>Đã chọn {value.length} nhà bán lẻ</strong>
      <Checkbox label="Chỉ hiện đã chọn" checked={selectedOnly} onChange={setSelectedOnly} />
    </div>
    {error && <p className="field-err" role="alert">{error}</p>}
    {selectedOnly ? <DataTable key="selected" urlState={false} title="Nhà bán lẻ đã chọn" rows={value}
      columns={selectionColumns} rowKey={r => r.id} pageSize={10} searchPlaceholder="Tìm trong danh sách đã chọn…"
      emptyText="Chưa chọn nhà bán lẻ áp dụng." />
      : <DataTable key="all" urlState={false} title="Danh sách nhà bán lẻ" rows={query.data?.items} loading={query.isFetching}
        error={query.error} rowKey={r => r.id} searchPlaceholder="Tìm mã, tên hoặc địa chỉ cửa hàng…"
        actions={<Button size="sm" loading={query.isFetching} onClick={() => void query.refetch()}>Tải lại</Button>}
        server={{ page, size: 10, total: query.data?.totalCount ?? 0, onPageChange: setPage,
          pageSizeOptions: [10], search, onSearchChange: term => { setSearch(term); setPage(1); } }}
        columns={selectionColumns} />}
  </Card>;
}
