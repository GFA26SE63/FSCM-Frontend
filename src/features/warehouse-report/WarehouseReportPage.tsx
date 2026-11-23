import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, getAll } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { Button, Callout, Card, Chip, DateInput, EmptyState, Fields, Modal, PageHeader, QueryState, Stat } from '@/shared/ui';
import { formatDate, formatNumber } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { downloadExcel } from '@/shared/lib/excel';
import { defaultDashboardDates } from '@/features/dashboard/dashboardModel';
import {
  DEFAULT_TOP,
  GROUP_LABELS,
  METRICS,
  TOP_OPTIONS,
  nextSort,
  rangeError,
  reportSummary,
  sortProducts,
  toReportParams,
  warehouseReportSheets,
  warehouseTotals,
  MAX_WAREHOUSES,
  keepSelectable,
  selectableWarehouses,
  type WarehouseOption,
  type MetricGroup,
  type MetricKey,
  type MetricSort,
  type WarehouseReport,
  type WarehouseReportFilters,
  type WarehouseReportProductStock,
  type WarehouseReportWarehouse,
} from './warehouseReportModel';
import './warehouseReport.css';

const loadReport = (f: WarehouseReportFilters) => get<WarehouseReport>('/reports/warehouse-logistics', toReportParams(f));

function Qty({ value, tone }: { value: number; tone: string }) {
  return <span className={`wr-qty wr-${tone}${value ? '' : ' wr-zero'}`}>{formatNumber(value)}</span>;
}

function Legend() {
  return (
    <div className="wr-legend">
      {(Object.keys(GROUP_LABELS) as MetricGroup[]).map((group) => (
        <div key={group} className="wr-legend-group">
          <span className="muted small">{GROUP_LABELS[group]}:</span>
          {METRICS.filter((m) => m.group === group).map((m) => (
            <span key={m.key} className={`wr-qty wr-${m.tone}`} title={m.hint}>{m.label}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function WarehouseCard({ warehouse, sort, onSort, onSelect }: {
  warehouse: WarehouseReportWarehouse;
  sort: MetricSort;
  onSort: (key: MetricKey) => void;
  onSelect: (p: WarehouseReportProductStock) => void;
}) {
  const totals = warehouseTotals(warehouse);
  const products = sortProducts(warehouse.products, sort);
  return (
    <Card
      flush
      title={<h2 className="sec">{warehouse.code} · {warehouse.name}</h2>}
      actions={
        <div className="wr-chips">
          {warehouse.regionName && <Chip tone="neutral">{warehouse.regionName}</Chip>}
          <Chip tone="info">{formatNumber(warehouse.driverCount)} tài xế</Chip>
          <Chip tone="info">{formatNumber(warehouse.vehicleCount)} xe</Chip>
        </div>
      }
    >
      {warehouse.products.length === 0 ? (
        <p className="muted" style={{ margin: '10px 14px 14px' }}>Chưa có sản phẩm nào có lịch sử bán hàng hoặc tồn kho.</p>
      ) : (
        // Fixed layout at 100% width: every SKU fits on screen without horizontal scrolling.
        <table className="tbl compact wr-grid">
          <colgroup>
            <col className="wr-col-action" />
            <col className="wr-col-rank" />
            <col />
            {METRICS.map((m) => <col key={m.key} className="wr-col-metric" />)}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} aria-label="Thao tác" />
              <th rowSpan={2} className="wr-center">#</th>
              <th rowSpan={2}>SKU · Sản phẩm</th>
              {(Object.keys(GROUP_LABELS) as MetricGroup[]).map((group) => (
                <th key={group} colSpan={METRICS.filter((m) => m.group === group).length} className={`wr-center wr-group wr-group-${group}`}>
                  {GROUP_LABELS[group]}
                </th>
              ))}
            </tr>
            <tr>
              {METRICS.map((m) => {
                const active = sort?.key === m.key ? sort.dir : null;
                return (
                  <th key={m.key} className="wr-right" aria-sort={active === 'desc' ? 'descending' : active === 'asc' ? 'ascending' : 'none'}>
                    <button
                      type="button"
                      className={`wr-sort${active ? ' active' : ''}`}
                      title={`${m.hint}. Nhấn để sắp xếp: nhiều nhất → ít nhất → theo hạng bán chạy`}
                      onClick={() => onSort(m.key)}
                    >
                      {m.short}
                      <span className="wr-sort-icon" aria-hidden>{active === 'desc' ? '▼' : active === 'asc' ? '▲' : '↕'}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.productId}>
                <td><Button size="sm" onClick={() => onSelect(p)}>Chi tiết</Button></td>
                <td className="wr-center">{p.rank}</td>
                <td className="wr-product" title={`${p.sku} · ${p.name}`}>
                  <span className="bold">{p.sku}</span>
                  <span className="muted small">{p.name}</span>
                </td>
                {METRICS.map((m) => <td key={m.key} className="wr-right"><Qty value={p[m.key]} tone={m.tone} /></td>)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td />
              <td className="bold">Tổng</td>
              {METRICS.map((m) => <td key={m.key} className="wr-right" title={m.hint}><Qty value={totals[m.key]} tone={m.tone} /></td>)}
            </tr>
          </tfoot>
        </table>
      )}
    </Card>
  );
}

export function WarehouseReportPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<WarehouseReportFilters>(() => ({ ...defaultDashboardDates(), regionId: '', top: DEFAULT_TOP, warehouseIds: [] }));
  const [selected, setSelected] = useState<{ warehouse: WarehouseReportWarehouse; product: WarehouseReportProductStock } | null>(null);
  const invalid = rangeError(filters.fromDate, filters.toDate);
  const regions = useQuery({
    queryKey: ['warehouse-report-regions', user?.id],
    queryFn: () => getAll<{ id: string; name: string }>('/regions'),
    enabled: !!user,
  });
  const warehouseList = useQuery({
    queryKey: ['warehouse-report-warehouses', user?.id],
    queryFn: () => getAll<WarehouseOption>('/warehouses'),
    enabled: !!user,
  });
  const options = selectableWarehouses(warehouseList.data ?? [], filters.regionId);
  const picked = filters.warehouseIds ?? [];
  const togglePicked = (id: string) => setFilters((f) => {
    const ids = f.warehouseIds ?? [];
    return { ...f, warehouseIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(0, MAX_WAREHOUSES) };
  });
  // The report loads only for the warehouses the user picked, so one screen never renders every warehouse.
  const report = useQuery({
    queryKey: ['warehouse-logistics-report', user?.id, filters],
    queryFn: () => loadReport(filters),
    enabled: !invalid && !!user && picked.length > 0,
  });
  // One sort for every warehouse table so warehouses stay comparable; the Excel file uses it too.
  const [sort, setSort] = useState<MetricSort>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  async function exportExcel() {
    if (!report.data) return;
    setExporting(true);
    setExportError('');
    try {
      const sheets = warehouseReportSheets(report.data, {
        regionName: regions.data?.find((r) => r.id === filters.regionId)?.name,
        sort,
        exportedAt: formatInstantDateTime(new Date().toISOString()),
      });
      await downloadExcel(`bao-cao-kho-van-${filters.fromDate}-${filters.toDate}.xlsx`, sheets);
    } catch (error) {
      setExportError(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Báo cáo kho vận"
        actions={
          <Button disabled={!!invalid || !report.data || report.isFetching} loading={exporting} onClick={() => void exportExcel()}>
            Xuất Excel
          </Button>
        }
      />
      {exportError && <Callout tone="danger">{exportError}</Callout>}
      <div className="card wr-filters">
        <label className="lbl">Từ ngày<DateInput required value={filters.fromDate} onChange={(fromDate) => setFilters((f) => ({ ...f, fromDate }))} /></label>
        <label className="lbl">Đến ngày<DateInput required min={filters.fromDate} value={filters.toDate} onChange={(toDate) => setFilters((f) => ({ ...f, toDate }))} /></label>
        <label className="lbl">
          Khu vực
          <select
            className="inp"
            value={filters.regionId}
            onChange={(e) => {
              const regionId = e.target.value;
              setFilters((f) => ({
                ...f,
                regionId,
                warehouseIds: keepSelectable(f.warehouseIds ?? [], selectableWarehouses(warehouseList.data ?? [], regionId)),
              }));
            }}
          >
            <option value="">Tất cả khu vực</option>
            {regions.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="lbl">
          Sản phẩm bán chạy
          <select className="inp" value={filters.top} onChange={(e) => setFilters((f) => ({ ...f, top: Number(e.target.value) }))}>
            {TOP_OPTIONS.map((n) => <option key={n} value={n}>Top {n}</option>)}
          </select>
        </label>
        <Button onClick={() => void report.refetch()} loading={report.isFetching} disabled={!!invalid || picked.length === 0}>Làm mới</Button>
      </div>
      <Card
        title={`Chọn kho hiển thị · đã chọn ${formatNumber(picked.length)} / ${formatNumber(options.length)}`}
        actions={
          <div className="wr-chips">
            <Button size="sm" disabled={options.length === 0} onClick={() => setFilters((f) => ({ ...f, warehouseIds: options.slice(0, MAX_WAREHOUSES).map((w) => w.id) }))}>
              {options.length > MAX_WAREHOUSES ? `Chọn ${MAX_WAREHOUSES} kho đầu` : 'Chọn tất cả'}
            </Button>
            <Button size="sm" disabled={picked.length === 0} onClick={() => setFilters((f) => ({ ...f, warehouseIds: [] }))}>Bỏ chọn</Button>
          </div>
        }
      >
        <QueryState query={warehouseList}>
          {() => options.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Không có kho đang hoạt động trong khu vực đã chọn.</p>
          ) : (
            <div className="wr-picker" role="group" aria-label="Chọn kho hiển thị">
              {options.map((w) => {
                const on = picked.includes(w.id);
                return (
                  <label key={w.id} className={`wr-pick${on ? ' on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && picked.length >= MAX_WAREHOUSES}
                      onChange={() => togglePicked(w.id)}
                    />
                    <span><b>{w.code}</b> · {w.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </QueryState>
      </Card>
      {regions.isError && (
        <Callout tone="danger">
          Không tải được danh sách khu vực.{'\n'}{errorMessage(regions.error)} <Button size="sm" onClick={() => void regions.refetch()}>Thử lại</Button>
        </Callout>
      )}
      {invalid ? (
        <Callout tone="danger">{invalid}</Callout>
      ) : picked.length === 0 ? (
        <EmptyState title="Chọn ít nhất một kho để xem báo cáo." description="Đánh dấu các kho cần xem ở khung “Chọn kho hiển thị” phía trên." />
      ) : (
        <QueryState query={report}>
          {(data) => {
            const summary = reportSummary(data);
            return (
              <>
                <div className="wr-summary">
                  <Stat label="Số kho" value={formatNumber(summary.warehouses)} />
                  <Stat label="Tài xế đang hoạt động" value={formatNumber(summary.drivers)} />
                  <Stat label="Xe đang hoạt động" value={formatNumber(summary.vehicles)} />
                  <Stat label="SKU bán chạy" value={`${formatNumber(summary.products)} / ${formatNumber(data.top)}`} />
                </div>
                <Legend />
                {data.warehouses.length === 0 ? (
                  <EmptyState title="Không có kho nào trong khu vực đã chọn." />
                ) : (
                  <div className="stack" style={{ gap: 16 }}>
                    {data.warehouses.map((w) => (
                      <WarehouseCard
                        key={w.id}
                        warehouse={w}
                        sort={sort}
                        onSort={(key) => setSort((s) => nextSort(s, key))}
                        onSelect={(product) => setSelected({ warehouse: w, product })}
                      />
                    ))}
                  </div>
                )}
              </>
            );
          }}
        </QueryState>
      )}
      <Modal
        open={!!selected}
        width={760}
        title={selected ? `${selected.product.sku} · ${selected.product.name}` : ''}
        subtitle={selected ? `${selected.warehouse.code} · ${selected.warehouse.name} · ${formatDate(filters.fromDate)} – ${formatDate(filters.toDate)}` : undefined}
        onClose={() => setSelected(null)}
        footer={<Button onClick={() => setSelected(null)}>Đóng</Button>}
      >
        {selected && (
          <div className="stack" style={{ gap: 16 }}>
            <Fields
              cols={3}
              items={[
                { label: 'Hạng bán chạy', value: `#${selected.product.rank}` },
                { label: 'Tồn vật lý hiện tại', value: formatNumber(selected.product.onHand) },
                { label: 'Khu vực', value: selected.warehouse.regionName || '—' },
              ]}
            />
            {(Object.keys(GROUP_LABELS) as MetricGroup[]).map((group) => (
              <div key={group}>
                <h3 className="sec" style={{ marginBottom: 8 }}>{GROUP_LABELS[group]}</h3>
                <Fields
                  cols={METRICS.filter((m) => m.group === group).length > 2 ? 3 : 2}
                  items={METRICS.filter((m) => m.group === group).map((m) => ({
                    label: m.label,
                    value: <span title={m.hint}><Qty value={selected.product[m.key]} tone={m.tone} /></span>,
                  }))}
                />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
