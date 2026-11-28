import { hasOperation } from '@/shared/auth/permissions';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthContext';
import { Button, Card, Checkbox, DataTable, type Column } from '@/shared/ui';
import { statusLabel } from '@/shared/lib/status';
import { errorMessage } from '@/shared/api/errors';
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

export function ProgramRetailerTable({ value, onChange, error, disabled, onBusyChange }: {
  value: ProgramRetailerOption[]; onChange: (rows: ProgramRetailerOption[]) => void; error?: string; disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { user } = useAuth();
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function selectAll() {
    if (disabled || busy.current || !hasOperation(user, 'api:Loyalty.List')) return;
    busy.current = true; setSelecting(true); setSelectionError(''); onBusyChange?.(true);
    try {
      const rows = await loyaltyApi.activeProgramRetailers();
      if (mounted.current) onChange([...new Map([...value, ...rows].map(row => [row.id, row])).values()]);
    } catch (cause) {
      if (mounted.current) setSelectionError(errorMessage(cause));
    } finally {
      busy.current = false;
      if (mounted.current) { setSelecting(false); onBusyChange?.(false); }
    }
  }
  const query = useQuery({ queryKey: ['loyalty', 'program-retailer-page', user?.id, 'Active', page, search, pageSize],
    queryFn: () => loyaltyApi.programRetailersPage(page, search, pageSize), enabled: hasOperation(user, 'api:Loyalty.List') && !selectedOnly });
  const selectionColumns: Column<ProgramRetailerOption>[] = [{
    key: 'select', header: 'Chọn', width: '65px', render: row => <input type="checkbox"
      aria-label={`Chọn ${row.code} · ${row.name}`} checked={value.some(item => item.id === row.id)}
      disabled={disabled || selecting || (!selectedOnly && (query.isFetching || !!query.error))}
      onChange={event => {
        if (disabled || busy.current) return;
        onChange(event.target.checked
          ? [...value.filter(item => item.id !== row.id), row]
          : value.filter(item => item.id !== row.id));
      }} />,
  }, ...columns];
  const selectionControls = <>
    <div className="row-wrap" style={{ gap: 16, marginBottom: 12 }}>
      <strong>Đã chọn {value.length} nhà bán lẻ</strong>
      <Button size="sm" loading={selecting} disabled={disabled || selecting} onClick={() => void selectAll()}>Chọn tất cả</Button>
      <Button size="sm" disabled={disabled || selecting || value.length === 0}
        onClick={() => { if (!busy.current) { setSelectionError(''); onChange([]); } }}>Bỏ chọn tất cả</Button>
      <Checkbox label="Chỉ hiện đã chọn" checked={selectedOnly} onChange={setSelectedOnly} />
    </div>
    <p className="muted small">Chọn tất cả nhà bán lẻ đang hoạt động, gồm mọi trang và ngoài kết quả tìm kiếm.</p>
    {selectionError && <p className="field-err" role="alert">{selectionError}</p>}
    {error && <p className="field-err" role="alert">{error}</p>}
  </>;
  return <Card title="Nhà bán lẻ áp dụng">
    <p>Chọn ít nhất một nhà bán lẻ. Lựa chọn được lưu cùng chương trình khi nhấn Tạo chương trình.</p>
    {selectedOnly ? <DataTable key="selected" urlState={false} title="Nhà bán lẻ đã chọn" rows={value}
      beforeTable={selectionControls}
      columns={selectionColumns} rowKey={r => r.id} pageSize={10} searchPlaceholder="Tìm trong danh sách đã chọn…"
      emptyText="Chưa chọn nhà bán lẻ áp dụng." />
      : <DataTable key="all" urlState={false} title="Danh sách nhà bán lẻ" rows={query.data?.items} loading={query.isFetching}
        beforeTable={selectionControls}
        error={query.error} rowKey={r => r.id} searchPlaceholder="Tìm mã, tên hoặc địa chỉ cửa hàng…"
        actions={<Button size="sm" loading={query.isFetching} onClick={() => void query.refetch()}>Tải lại</Button>}
        server={{ page, size: pageSize, total: query.data?.totalCount ?? 0, onPageChange: setPage,
          onPageSizeChange: size => { setPageSize(size); setPage(1); },
          pageSizeOptions: [10, 20, 50], search, onSearchChange: term => { setSearch(term); setPage(1); } }}
        columns={selectionColumns} />}
  </Card>;
}
