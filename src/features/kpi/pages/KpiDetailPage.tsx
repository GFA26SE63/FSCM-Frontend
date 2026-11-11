import { useAuth } from '@/shared/auth/AuthContext';
import { Link, useParams } from '@/shared/router/compat';
import {
  Button,
  Callout,
  Card,
  Chip,
  DataTable,
  Fields,
  PageHeader,
  QueryState,
  type Column,
} from '@/shared/ui';
import { formatDate, formatMoney, formatNumber, formatPercent } from '@/shared/lib';

import { canReadRankings } from '../api';
import { completionTone, formatCompletion, reportSearch } from '../filters';
import {
  useRankingFilters,
  useSalesKpi,
  useSalesRanking,
} from '../hooks';
import type { SalesKpiMetric, SalesKpiOrder } from '../types';

export function KpiDetailPage() {
  const { user } = useAuth();

  if (!canReadRankings(user)) {
    return (
      <Callout tone="danger">
        Bạn không có quyền xem báo cáo.
      </Callout>
    );
  }

  return (
    <RankingDetailRouter
      key={JSON.stringify([user?.id, user?.role, user?.scope])}
    />
  );
}

function RankingDetailRouter() {
  const { tab } = useRankingFilters();

  if (tab === 'sales') {
    return <SalesRankingDetail />;
  }

  return <SalesKpiDetail />;
}

function SalesKpiDetail() {
  const { salesUserId = '', groupId = '' } = useParams();
  const { filters, validationError } = useRankingFilters();
  const query = useSalesKpi(filters);

  const back = `/kpi${reportSearch(filters, 'kpi')}`;

  if (validationError) {
    return (
      <>
        <PageHeader back={back} title="Bộ lọc không hợp lệ" />
        <Callout tone="danger">{validationError}</Callout>
      </>
    );
  }

  return (
    <QueryState query={query}>
      {(report) => {
        const row = report.entries.find(
          (item) =>
            item.salesUserId === salesUserId &&
            item.salesGroupId === groupId,
        );

        if (!row) {
          return (
            <>
              <PageHeader
                back={back}
                title="Chi tiết chỉ tiêu KPI Sales"
                subtitle={`Kỳ báo cáo: ${formatDate(report.fromDate)} – ${formatDate(report.toDate)}`}
                actions={
                  <Button
                    disabled={query.isFetching}
                    onClick={() => void query.refetch()}
                  >
                    Tải lại
                  </Button>
                }
              />
              <Callout tone="warn">
                Không tìm thấy dữ liệu KPI của nhân viên Sales này trong kỳ hoặc phạm vi báo cáo hiện tại.
              </Callout>
            </>
          );
        }

        const completionFormatted = formatCompletion(row.overallCompletionRate);
        const completionToneVal = completionTone(row.overallCompletionRate);
        const orders = row.orders ?? [];
        const metrics = row.metrics ?? [];
        const totalRecognized = row.recognizedRevenue;

        const metricColumns: Column<SalesKpiMetric>[] = [
          {
            key: 'code',
            header: 'Mã chỉ tiêu',
            width: '130px',
            render: (m) => <span className="mono bold">{m.code || '—'}</span>,
          },
          {
            key: 'name',
            header: 'Tên chỉ tiêu',
            render: (m) => m.name || '—',
          },
          {
            key: 'target',
            header: 'Chỉ tiêu giao',
            align: 'right',
            render: (m) =>
              m.unit?.toLowerCase().includes('đ') || m.code.toLowerCase().includes('rev')
                ? formatMoney(m.target)
                : `${formatNumber(m.target)} ${m.unit || ''}`,
          },
          {
            key: 'actual',
            header: 'Thực tế đạt',
            align: 'right',
            render: (m) =>
              m.unit?.toLowerCase().includes('đ') || m.code.toLowerCase().includes('rev')
                ? formatMoney(m.actual)
                : `${formatNumber(m.actual)} ${m.unit || ''}`,
          },
          {
            key: 'weight',
            header: 'Trọng số',
            align: 'right',
            width: '100px',
            render: (m) => formatPercent(m.weight),
          },
          {
            key: 'rate',
            header: 'Tỷ lệ hoàn thành',
            align: 'right',
            width: '150px',
            render: (m) => {
              const formatted = formatCompletion(m.completionRate);
              const tone = completionTone(m.completionRate);
              return (
                <Chip tone={tone}>
                  {formatted}
                </Chip>
              );
            },
          },
        ];

        const orderColumns: Column<SalesKpiOrder>[] = [
          {
            key: 'index',
            header: 'STT',
            width: '50px',
            align: 'right',
            render: (o) => <span className="muted">{orders.indexOf(o) + 1}</span>,
          },
          {
            key: 'orderCode',
            header: 'Mã đơn hàng',
            width: '140px',
            render: (o) => (
              <Link
                to={`/orders/${o.orderId}`}
                className="bold text-primary"
                style={{ textDecoration: 'none' }}
              >
                {o.orderCode}
              </Link>
            ),
          },
          {
            key: 'retailer',
            header: 'Khách hàng / Đại lý',
            render: (o) => (
              <div>
                <div className="bold">{o.retailerName}</div>
                <div className="muted text-xs">{o.retailerCode}</div>
              </div>
            ),
          },
          {
            key: 'recognitionDate',
            header: 'Ngày ghi nhận',
            width: '120px',
            render: (o) => formatDate(o.recognitionDate),
          },
          {
            key: 'revenueBeforePromotion',
            header: 'Tiền trước KM',
            align: 'right',
            render: (o) => formatMoney(o.revenueBeforePromotion),
          },
          {
            key: 'promotionAmount',
            header: 'Khuyến mãi',
            align: 'right',
            render: (o) =>
              o.promotionAmount > 0 ? (
                <span className="text-danger">-{formatMoney(o.promotionAmount)}</span>
              ) : (
                '0đ'
              ),
          },
          {
            key: 'approvedAdjustmentAmount',
            header: 'Điều chỉnh',
            align: 'right',
            render: (o) =>
              o.approvedAdjustmentAmount !== 0 ? (
                <span>{formatMoney(o.approvedAdjustmentAmount)}</span>
              ) : (
                '0đ'
              ),
          },
          {
            key: 'recognizedRevenue',
            header: 'Doanh thu ghi nhận',
            align: 'right',
            render: (o) => (
              <span className="bold text-success">
                {formatMoney(o.recognizedRevenue)}
              </span>
            ),
          },
          {
            key: 'pct',
            header: '% Đóng góp',
            align: 'right',
            width: '110px',
            render: (o) => {
              if (!totalRecognized || totalRecognized <= 0) return '—';
              const pct = (o.recognizedRevenue / totalRecognized) * 100;
              return (
                <span className="mono">
                  {pct > 0 ? `${pct.toFixed(1)}%` : '0%'}
                </span>
              );
            },
          },
        ];

        return (
          <>
            <PageHeader
              back={back}
              title={`Chi tiết chỉ tiêu KPI · ${row.salesUserName}`}
              subtitle={`Kỳ báo cáo: ${formatDate(report.fromDate)} – ${formatDate(report.toDate)}`}
              actions={
                <Button
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  Tải lại
                </Button>
              }
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {report.recognitionRule && (
                <Callout tone="info">
                  <strong>Quy tắc tính KPI:</strong> {report.recognitionRule}
                </Callout>
              )}

              <Card title={row.salesUserName}>
                <Fields
                  cols={3}
                  items={[
                    {
                      label: 'Nhân viên Sales',
                      value: row.salesUserName,
                    },
                    {
                      label: 'Nhóm Sales',
                      value: `${row.salesGroupCode} · ${row.salesGroupName}`,
                    },
                    {
                      label: 'Vùng hoạt động',
                      value: row.regionId || '—',
                    },
                    {
                      label: 'Doanh thu ghi nhận',
                      value: (
                        <span className="bold text-primary" style={{ fontSize: '1.1rem' }}>
                          {formatMoney(row.recognizedRevenue)}
                        </span>
                      ),
                    },
                    {
                      label: 'Số đơn ghi nhận',
                      value: orders.length,
                    },
                    {
                      label: 'Tỷ lệ hoàn thành tổng thể',
                      value: (
                        <Chip tone={completionToneVal}>
                          {completionFormatted}
                        </Chip>
                      ),
                    },
                  ]}
                />
              </Card>

              <Card title="Bảng phân rã chỉ tiêu KPI">
                {metrics.length === 0 ? (
                  <p className="muted">Không có chỉ tiêu nào được cấu hình cho nhân viên này.</p>
                ) : (
                  <DataTable
                    columns={metricColumns}
                    rows={metrics}
                    rowKey={(m) => m.code}
                  />
                )}
              </Card>

              <Card title={`Danh sách đơn hàng đóng góp (${orders.length} đơn)`}>
                {orders.length === 0 ? (
                  <p className="muted">Chưa có đơn hàng nào đóng góp vào kết quả trong kỳ này.</p>
                ) : (
                  <DataTable
                    columns={orderColumns}
                    rows={orders}
                    rowKey={(o) => o.orderId}
                  />
                )}
              </Card>
            </div>
          </>
        );
      }}
    </QueryState>
  );
}

function SalesRankingDetail() {
  const { salesUserId = '', groupId = '' } = useParams();
  const { filters, validationError } = useRankingFilters();
  const query = useSalesRanking(filters);

  const back = `/kpi${reportSearch(filters, 'sales')}`;

  if (validationError) {
    return (
      <>
        <PageHeader back={back} title="Bộ lọc không hợp lệ" />
        <Callout tone="danger">{validationError}</Callout>
      </>
    );
  }

  return (
    <QueryState query={query}>
      {(report) => {
        const row = report.entries.find(
          (item) =>
            item.salesUserId === salesUserId &&
            item.salesGroupId === groupId,
        );

        if (!row) {
          return (
            <>
              <PageHeader
                back={back}
                title="Chi tiết xếp hạng Sales"
                subtitle={`Kỳ báo cáo: ${formatDate(report.fromDate)} – ${formatDate(report.toDate)}`}
                actions={
                  <Button
                    disabled={query.isFetching}
                    onClick={() => void query.refetch()}
                  >
                    Tải lại
                  </Button>
                }
              />
              <Callout tone="warn">
                Không có dữ liệu Sales này trong kỳ hoặc phạm vi báo cáo hiện tại.
              </Callout>
            </>
          );
        }

        return (
          <>
            <PageHeader
              back={back}
              title={`Chi tiết xếp hạng Sales · ${row.salesUserName}`}
              subtitle={`Kỳ báo cáo: ${formatDate(report.fromDate)} – ${formatDate(report.toDate)}`}
              actions={
                <Button
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  Tải lại
                </Button>
              }
            />

            <Card title={row.salesUserName}>
              <Fields
                cols={2}
                items={[
                  { label: 'Thứ hạng', value: `#${row.rank}` },
                  {
                    label: 'Nhóm Sales',
                    value: `${row.salesGroupCode} · ${row.salesGroupName}`,
                  },
                  {
                    label: 'Số đơn ghi nhận',
                    value: row.orderCount,
                  },
                  {
                    label: 'Doanh thu ghi nhận',
                    value: formatMoney(row.recognizedRevenue),
                  },
                ]}
              />
            </Card>
          </>
        );
      }}
    </QueryState>
  );
}
