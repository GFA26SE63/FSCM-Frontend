import { useAuth } from '@/shared/auth/AuthContext';
import { useParams } from '@/shared/router/compat';
import {
  Button,
  Callout,
  Card,
  Fields,
  PageHeader,
  QueryState,
} from '@/shared/ui';
import { formatMoney } from '@/shared/lib';

import { canReadRankings } from '../api';
import { reportSearch } from '../filters';
import {
  useRankingFilters,
  useSalesRanking,
} from '../hooks';
import { ReportSummary } from '../components/ReportSummary';

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
    <SalesRankingDetail
      key={JSON.stringify([user?.id, user?.role, user?.scope])}
    />
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
    <>
      <PageHeader
        back={back}
        title="Chi tiết xếp hạng Sales"
        actions={
          <Button
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Tải lại
          </Button>
        }
      />

      <QueryState query={query}>
        {(report) => {
          const row = report.entries.find(
            (item) =>
              item.salesUserId === salesUserId &&
              item.salesGroupId === groupId,
          );

          if (!row) {
            return (
              <Callout tone="warn">
                Không có dòng Sales này trong kỳ hoặc phạm vi báo cáo hiện tại.
              </Callout>
            );
          }

          return (
            <>
              <ReportSummary
                fromDate={report.fromDate}
                toDate={report.toDate}
                scope={report.scope}
              />

              <Card title={row.salesUserName}>
                <Fields
                  cols={2}
                  items={[
                    { label: 'Thứ hạng', value: row.rank },
                    { label: 'Sales user ID', value: row.salesUserId },
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
    </>
  );
}