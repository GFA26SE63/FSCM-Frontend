import { useAuth } from '@/shared/auth/AuthContext';
import {
  Button,
  Callout,
  PageHeader,
  QueryState,
  Tabs,
} from '@/shared/ui';

import { canReadRankings } from '../api';
import {
  useProductRanking,
  useRankingFilters,
  useSalesRanking,
} from '../hooks';
import { RankingFilters } from '../components/RankingFilters';
import { ReportSummary } from '../components/ReportSummary';
import { SalesRankingTable } from '../components/SalesRankingTable';
import { ProductRankingTable } from '../components/ProductRankingTable';

export function KpiPage() {
  const { user } = useAuth();

  // Reset phần giao diện khi thay tài khoản hoặc scope.
  const identity = JSON.stringify([
    user?.id,
    user?.role,
    user?.scope,
  ]);

  if (!canReadRankings(user)) {
    return (
      <Callout tone="danger">
        Bạn không có quyền xem báo cáo xếp hạng.
      </Callout>
    );
  }

  return <RankingPageContent key={identity} />;
}

function RankingPageContent() {
  const {
    filters,
    tab,
    updateFilters,
    setTab,
    validationError,
  } = useRankingFilters();

  const sales = useSalesRanking(filters, tab === 'sales');
  const products = useProductRanking(filters, tab === 'products');

  const activeQuery = tab === 'sales' ? sales : products;

  return (
    <>
      <PageHeader
        title="Xếp hạng kinh doanh"
        subtitle="Số liệu và thứ hạng được tính bởi backend."
        actions={
          <Button
            disabled={Boolean(validationError) || activeQuery.isFetching}
            onClick={() => void activeQuery.refetch()}
          >
            {activeQuery.isFetching ? 'Đang tải…' : 'Tải lại'}
          </Button>
        }
      />

      <RankingFilters
        value={filters}
        productMode={tab === 'products'}
        error={validationError}
        onChange={updateFilters}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: 'sales', label: 'Xếp hạng Sales' },
          { key: 'products', label: 'Sản phẩm bán chạy' },
        ]}
      />

      {!validationError && (
        tab === 'sales' ? (
          <QueryState query={sales}>
            {(report) => (
              <>
                <ReportSummary
                  fromDate={report.fromDate}
                  toDate={report.toDate}
                  scope={report.scope}
                />

                <SalesRankingTable
                  rows={report.entries}
                  filters={filters}
                />
              </>
            )}
          </QueryState>
        ) : (
          <QueryState query={products}>
            {(report) => (
              <>
                <ReportSummary
                  fromDate={report.fromDate}
                  toDate={report.toDate}
                  scope={report.scope}
                  criterion={report.criterion}
                  quantityUnit={report.quantityUnit}
                  recognitionRule={report.recognitionRule}
                />

                <ProductRankingTable
                  rows={report.entries}
                  quantityUnit={report.quantityUnit}
                />
              </>
            )}
          </QueryState>
        )
      )}
    </>
  );
}