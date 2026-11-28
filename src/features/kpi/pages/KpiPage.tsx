import { useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { useNavigate } from '@/shared/router/compat';
import { downloadExcel } from '@/shared/lib/excel';
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

  async function handleExportExcel() {
    if (tab === 'kpi' && kpi.data) {
      await downloadExcel(`bao-cao-kpi-${filters.fromDate}-${filters.toDate}.xlsx`, [{
        name: 'KPI Bán hàng',
        title: 'Báo cáo chỉ tiêu KPI bán hàng',
        info: [`Kỳ: ${filters.fromDate} – ${filters.toDate}`, `Phạm vi: ${kpi.data.scope}`],
        blocks: [{
          columns: [
            { header: 'Nhân viên', width: 24 },
            { header: 'Mã nhóm', width: 14 },
            { header: 'Nhóm bán hàng', width: 24 },
            { header: 'Số đơn', numeric: true },
            { header: 'Doanh thu ghi nhận (đ)', numeric: true, width: 20 },
            { header: 'Hoàn thành KPI (%)', numeric: true, width: 16 },
          ],
          rows: kpi.data.entries.map((e) => [
            e.salesUserName,
            e.salesGroupCode,
            e.salesGroupName,
            e.orders?.length ?? 0,
            e.recognizedRevenue,
            Math.round(e.overallCompletionRate * 10000) / 100,
          ]),
        }],
      }]);
    } else if (tab === 'sales' && sales.data) {
      await downloadExcel(`xep-hang-sales-${filters.fromDate}-${filters.toDate}.xlsx`, [{
        name: 'Xếp hạng Sales',
        title: 'Xếp hạng nhân viên bán hàng',
        info: [`Kỳ: ${filters.fromDate} – ${filters.toDate}`, `Phạm vi: ${sales.data.scope}`],
        blocks: [{
          columns: [
            { header: 'Hạng', numeric: true, width: 8 },
            { header: 'Nhân viên', width: 24 },
            { header: 'Nhóm', width: 24 },
            { header: 'Số đơn', numeric: true },
            { header: 'Doanh thu ghi nhận (đ)', numeric: true, width: 20 },
          ],
          rows: sales.data.entries.map((e) => [
            e.rank, e.salesUserName, `${e.salesGroupCode} · ${e.salesGroupName}`, e.orderCount, e.recognizedRevenue,
          ]),
        }],
      }]);
    } else if (tab === 'products' && products.data) {
      await downloadExcel(`san-pham-ban-chay-${filters.fromDate}-${filters.toDate}.xlsx`, [{
        name: 'Sản phẩm bán chạy',
        title: 'Xếp hạng sản phẩm bán chạy',
        info: [`Kỳ: ${filters.fromDate} – ${filters.toDate}`, `Tiêu chí: ${products.data.criterion}`],
        blocks: [{
          columns: [
            { header: 'Hạng', numeric: true, width: 8 },
            { header: 'SKU', width: 16 },
            { header: 'Sản phẩm', width: 32 },
            { header: 'Ngành hàng', width: 20 },
            { header: 'Số đơn', numeric: true },
            { header: 'Số lượng (thùng)', numeric: true },
            { header: 'Trước giảm (đ)', numeric: true, width: 18 },
            { header: 'Doanh thu thuần (đ)', numeric: true, width: 20 },
          ],
          rows: products.data.entries.map((e) => [
            e.rank, e.sku, e.productName, e.categoryName ?? '', e.orderCount ?? 0,
            e.normalizedSoldQuantity, e.grossRevenue ?? 0, e.adjustedNetRevenue,
          ]),
        }],
      }]);
    }
  }

  return (
    <>
      <PageHeader
        title="Quản lý KPI & Xếp hạng kinh doanh"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button
              disabled={Boolean(validationError) || !activeQuery.data || activeQuery.isFetching}
              onClick={() => void handleExportExcel()}
            >
              Xuất Excel
            </Button>
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
          { key: 'kpi', label: 'Chỉ tiêu KPI bán hàng' },
          { key: 'sales', label: 'Xếp hạng nhân viên bán hàng' },
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
