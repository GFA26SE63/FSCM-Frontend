import { useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { useNavigate } from '@/shared/router/compat';
import {
  Button,
  Callout,
  PageHeader,
  QueryState,
  Tabs,
} from '@/shared/ui';

import { canManageKpi, canReadRankings } from '../api';
import {
  useProductRanking,
  useRankingFilters,
  useSalesKpi,
  useSalesRanking,
} from '../hooks';
import { RankingFilters } from '../components/RankingFilters';
import { SalesKpiTable } from '../components/SalesKpiTable';
import { SalesRankingTable } from '../components/SalesRankingTable';
import { ProductRankingTable } from '../components/ProductRankingTable';
import { KpiOrderBreakdownDialog } from '../components/KpiOrderBreakdownDialog';
import { KpiConfigDialog } from '../components/KpiConfigDialog';
import { reportSearch } from '../filters';
import type { SalesKpiEntry } from '../types';

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
        Bạn không có quyền xem báo cáo KPI và xếp hạng kinh doanh.
      </Callout>
    );
  }

  return <RankingPageContent key={identity} />;
}

function RankingPageContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    filters,
    tab,
    updateFilters,
    setTab,
    validationError,
  } = useRankingFilters();

  const [selectedEntry, setSelectedEntry] = useState<SalesKpiEntry | null>(null);
  const [configOpen, setConfigOpen] = useState<boolean>(false);

  const kpi = useSalesKpi(filters, tab === 'kpi');
  const sales = useSalesRanking(filters, tab === 'sales');
  const products = useProductRanking(filters, tab === 'products');

  const activeQuery = tab === 'kpi' ? kpi : tab === 'sales' ? sales : products;
  const canConfig = canManageKpi(user);

  return (
    <>
      <PageHeader
        title="Quản lý KPI & Xếp hạng kinh doanh"
        subtitle="Theo dõi chỉ tiêu, tiến độ hoàn thành và các đơn hàng ghi nhận doanh thu."
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {canConfig && (
              <Button
                onClick={() => setConfigOpen(true)}
              >
                Cấu hình trọng số KPI
              </Button>
            )}
            <Button
              disabled={Boolean(validationError) || activeQuery.isFetching}
              onClick={() => void activeQuery.refetch()}
            >
              {activeQuery.isFetching ? 'Đang tải…' : 'Tải lại'}
            </Button>
          </div>
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
          { key: 'kpi', label: 'Chỉ tiêu KPI Sales' },
          { key: 'sales', label: 'Xếp hạng Sales' },
          { key: 'products', label: 'Sản phẩm bán chạy' },
        ]}
      />

      {!validationError && (
        tab === 'kpi' ? (
          <QueryState query={kpi}>
            {(report) => (
              <>
                <SalesKpiTable
                  rows={report.entries}
                  filters={filters}
                  onOpenOrders={(entry) => setSelectedEntry(entry)}
                  onOpenDetail={(entry) =>
                    navigate(
                      `/kpi/sales/${entry.salesUserId}/${entry.salesGroupId}${reportSearch(
                        filters,
                        'kpi',
                      )}`,
                    )
                  }
                />

                <KpiOrderBreakdownDialog
                  open={Boolean(selectedEntry)}
                  entry={selectedEntry}
                  fromDate={report.fromDate}
                  toDate={report.toDate}
                  recognitionRule={report.recognitionRule}
                  onClose={() => setSelectedEntry(null)}
                />
              </>
            )}
          </QueryState>
        ) : tab === 'sales' ? (
          <QueryState query={sales}>
            {(report) => (
              <SalesRankingTable
                rows={report.entries}
                filters={filters}
              />
            )}
          </QueryState>
        ) : (
          <QueryState query={products}>
            {(report) => (
              <ProductRankingTable
                rows={report.entries}
                quantityUnit={report.quantityUnit}
              />
            )}
          </QueryState>
        )
      )}

      {canConfig && (
        <KpiConfigDialog
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          onSaved={() => {
            void kpi.refetch();
          }}
        />
      )}
    </>
  );
}
