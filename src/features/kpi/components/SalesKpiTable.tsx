import {
  Button,
  Chip,
  DataTable,
  type Column,
} from '@/shared/ui';
import { formatMoney } from '@/shared/lib';

import { formatCompletion } from '../filters';
import type {
  ReportFilters,
  SalesKpiEntry,
  SalesKpiMetric,
} from '../types';

interface Props {
  rows: SalesKpiEntry[];
  filters: ReportFilters;
  onOpenOrders: (entry: SalesKpiEntry) => void;
  onOpenDetail?: (entry: SalesKpiEntry) => void;
}

function findMetric(entry: SalesKpiEntry, codePrefix: string): SalesKpiMetric | undefined {
  if (!entry.metrics) return undefined;
  return entry.metrics.find((m) =>
    (m.code && m.code.toLowerCase().includes(codePrefix.toLowerCase())) ||
    (m.name && m.name.toLowerCase().includes(codePrefix.toLowerCase()))
  );
}

export function SalesKpiTable({ rows, onOpenOrders, onOpenDetail }: Props) {
  const columns: Column<SalesKpiEntry>[] = [
    {
      key: 'order',
      header: 'STT',
      width: '60px',
      align: 'right',
      render: (row) => <span className="muted">{rows.indexOf(row) + 1}</span>,
    },
    {
      key: 'salesUserName',
      header: 'Sales',
      text: (row) => row.salesUserName,
      render: (row) => (
        <div>
          <strong style={{ fontSize: 13.5 }}>{row.salesUserName}</strong>
        </div>
      ),
    },
    {
      key: 'group',
      header: 'Nhóm Sales',
      text: (row) => [row.salesGroupCode, row.salesGroupName].filter(Boolean).join(' · '),
      render: (row) => (
        <span style={{ fontSize: 13 }}>
          {[row.salesGroupCode, row.salesGroupName].filter(Boolean).join(' · ')}
        </span>
      ),
    },
    {
      key: 'target',
      header: 'Mục tiêu doanh thu',
      align: 'right',
      text: (row) => {
        const revMetric = findMetric(row, 'rev') || findMetric(row, 'doanh thu');
        return revMetric && revMetric.target > 0 ? formatMoney(revMetric.target) : '—';
      },
      render: (row) => {
        const revMetric = findMetric(row, 'rev') || findMetric(row, 'doanh thu');
        if (!revMetric || revMetric.target <= 0) {
          return <span className="muted">—</span>;
        }
        return <span>{formatMoney(revMetric.target)}</span>;
      },
    },
    {
      key: 'recognizedRevenue',
      header: 'Thực đạt (sau KM)',
      align: 'right',
      text: (row) => formatMoney(row.recognizedRevenue),
      render: (row) => (
        <div>
          <strong style={{ color: 'var(--c-primary, #14655B)' }}>
            {formatMoney(row.recognizedRevenue)}
          </strong>
        </div>
      ),
    },
    {
      key: 'revCompletion',
      header: '% Doanh thu',
      width: '140px',
      text: (row) => {
        const revMetric = findMetric(row, 'rev') || findMetric(row, 'doanh thu');
        return revMetric ? formatCompletion(revMetric.completionRate) : '—';
      },
      render: (row) => {
        const revMetric = findMetric(row, 'rev') || findMetric(row, 'doanh thu');
        const rate = revMetric?.completionRate ?? (row.overallCompletionRate || 0);
        const cappedWidth = Math.min(100, Math.max(0, rate));
        const barColor = rate >= 100 ? '#15803d' : rate >= 70 ? '#0284c7' : '#d97706';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ fontWeight: 600 }}>{formatCompletion(rate)}</span>
            </div>
            <div
              style={{
                height: 6,
                backgroundColor: 'var(--c-border, #E5E7EB)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${cappedWidth}%`,
                  backgroundColor: barColor,
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'metrics',
      header: 'Chỉ tiêu chi tiết',
      text: (row) => (row.metrics ?? []).map((m) => `${m.name}: ${m.actual}/${m.target}`).join(', '),
      render: (row) => {
        const metrics = row.metrics ?? [];
        if (metrics.length === 0) {
          return <span className="muted" style={{ fontSize: 12 }}>Mặc định</span>;
        }

        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {metrics.map((m) => {
              const pct = formatCompletion(m.completionRate);
              return (
                <span
                  key={m.code || m.name}
                  style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 4,
                    backgroundColor: 'var(--c-surface, #F3F4F6)',
                    border: '1px solid var(--c-border, #E5E7EB)',
                    whiteSpace: 'nowrap',
                  }}
                  title={`Trọng số: ${m.weight}% · Điểm trọng số: ${m.weightedScore}`}
                >
                  <strong>{m.name}:</strong> {pct}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'overallCompletionRate',
      header: 'Điểm KPI',
      align: 'right',
      text: (row) => formatCompletion(row.overallCompletionRate),
      render: (row) => (
        <strong style={{ fontSize: 13.5 }}>
          {formatCompletion(row.overallCompletionRate)}
        </strong>
      ),
    },
    {
      key: 'status',
      header: 'Kết quả',
      width: '110px',
      text: (row) => (row.overallCompletionRate >= 100 ? 'Đạt' : 'Chưa đạt'),
      render: (row) => {
        const isPassed = row.overallCompletionRate >= 100;
        return (
          <Chip tone={isPassed ? 'success' : 'warn'}>
            {isPassed ? 'Đạt' : 'Chưa đạt'}
          </Chip>
        );
      },
    },
  ];

  return (
    <DataTable
      title="Bảng theo dõi KPI Sales"
      rows={rows}
      columns={columns}
      rowKey={(row) => `${row.salesUserId}:${row.salesGroupId}`}
      searchPlaceholder="Tên Sales, mã hoặc tên nhóm…"
      onRowClick={onOpenDetail || onOpenOrders}
      rowActionsWidth="130px"
      rowActions={(row) => (
        <Button
          size="sm"
          variant="primary"
          onClick={(e) => {
            e.stopPropagation();
            onOpenOrders(row);
          }}
        >
          Xem đơn hàng
        </Button>
      )}
      emptyText="Không có dữ liệu KPI được ghi nhận trong kỳ và phạm vi này."
    />
  );
}
