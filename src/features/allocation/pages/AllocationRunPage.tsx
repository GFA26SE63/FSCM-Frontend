import { useMemo, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, Chip, DataTable, Input, PageHeader, type Column, type Tone } from '@/shared/ui';
import { formatMoney, formatNumber } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { env } from '@/shared/lib/env';
import { useAllocationRuns, useStartAllocationRun } from '../hooks';
import type { AllocationRunSummary, RunStatus } from '../types';

const RUN_STATUS: Record<RunStatus, { tone: Tone; label: string }> = {
  Snapshotted: { tone: 'info', label: 'Đã chốt dữ liệu' },
  Planning: { tone: 'info', label: 'Đang tính' },
  AwaitingApproval: { tone: 'warn', label: 'Chờ duyệt' },
  Approved: { tone: 'success', label: 'Đã duyệt' },
  Closed: { tone: 'neutral', label: 'Đã đóng' },
  Failed: { tone: 'danger', label: 'Thất bại' },
};

const currentDate = () => (env.useMock ? '2026-09-28' : new Date().toISOString().slice(0, 10));
const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
const currentSlotLocal = () => {
  if (env.useMock) return '2026-09-28T21:00';
  const now = new Date();
  now.setHours(Math.floor(now.getHours() / 3) * 3, 0, 0, 0);
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
};

export function AllocationRunPage() {
  const navigate = useNavigate();
  const today = currentDate();
  const [fromDate, setFromDate] = useState(monthStart(today));
  const [toDate, setToDate] = useState(today);
  const [runAt, setRunAt] = useState(currentSlotLocal());
  const query = useAllocationRuns(fromDate, toDate);
  const startRun = useStartAllocationRun();

  const columns = useMemo<Column<AllocationRunSummary>[]>(() => [
    { key: 'code', header: 'Mã đợt', width: '160px', render: (row) => <strong>{row.runCode}</strong> },
    { key: 'cutoff', header: 'Mốc chốt', width: '170px', text: (row) => formatInstantDateTime(row.cutoffAt) },
    { key: 'time', header: 'Bắt đầu xử lý', width: '170px', text: (row) => formatInstantDateTime(row.startedAt) },
    { key: 'orders', header: 'Tổng đơn', width: '90px', align: 'right', text: (row) => formatNumber(row.orderCount) },
    { key: 'full', header: 'Đủ hàng', width: '90px', align: 'right', text: (row) => formatNumber(row.fulfilledOrderCount) },
    { key: 'short', header: 'Thiếu hàng', width: '100px', align: 'right', text: (row) => formatNumber(row.shortOrderCount) },
    { key: 'amount', header: 'Giá trị phương án', width: '150px', align: 'right', text: (row) => formatMoney(row.totalFinalAmount) },
    {
      key: 'status', header: 'Trạng thái', width: '120px',
      render: (row) => <Chip tone={RUN_STATUS[row.status].tone}>{RUN_STATUS[row.status].label}</Chip>,
    },
  ], []);

  return (
    <>
      <PageHeader
        title="Các đợt allocation"
        subtitle="Hệ thống chạy mỗi 3 giờ. Mỗi dòng là một mốc chốt độc lập; chọn đợt để xem và duyệt phương án."
        actions={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input aria-label="Mốc chạy allocation" type="datetime-local" step={10800} value={runAt} onChange={(event) => setRunAt(event.target.value)} />
            <Button
              variant="primary"
              loading={startRun.isPending}
              onClick={async () => {
                const run = await startRun.mutateAsync({ cutoffAt: new Date(runAt).toISOString() });
                navigate(`/allocation/${run.id}`);
              }}
            >
              Chạy allocation
            </Button>
          </div>
        )}
      />

      <DataTable
        title="Lịch sử chạy allocation"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(row) => row.id}
        columns={columns}
        searchPlaceholder="Tìm mã đợt…"
        filterExtra={(
          <>
            <label className="lbl">
              Từ ngày
              <Input aria-label="Từ ngày" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className="lbl">
              Đến ngày
              <Input aria-label="Đến ngày" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
          </>
        )}
        onClearExtra={() => {
          setFromDate(monthStart(today));
          setToDate(today);
        }}
        onRowClick={(row) => navigate(`/allocation/${row.id}`)}
        rowActionsWidth="100px"
        rowActions={(row) => <Button size="sm" onClick={() => navigate(`/allocation/${row.id}`)}>Xem</Button>}
      />
    </>
  );
}
