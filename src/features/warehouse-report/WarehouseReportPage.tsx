import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useHistory } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
  MAX_WAREHOUSES,
  METRICS,
  TOP_OPTIONS,
  buildSkuComparisons,
  buildWarehouseChartData,
  keepSelectable,
  nextSort,
  rangeError,
  selectableWarehouses,
  sortProducts,
  toReportParams,
  warehouseReportSheets,
  type MetricGroup,
  type MetricSort,
  type SkuComparisonRow,
  type WarehouseOption,
  type WarehouseReport,
  type WarehouseReportFilters,
  type WarehouseReportProductStock,
  type WarehouseReportWarehouse,
} from './warehouseReportModel';
import './warehouseReport.css';

const loadReport = (f: WarehouseReportFilters) => get<WarehouseReport>('/reports/warehouse-logistics', toReportParams(f));
const DEFAULT_PICKED_WAREHOUSES = 8;

function Qty({ value, tone }: { value: number; tone: string }) {
  return <span className={`wr-qty wr-${tone}${value ? '' : ' wr-zero'}`}>{formatNumber(value)}</span>;
}

export function WarehouseReportPage() {
  const { user } = useAuth();
  const history = useHistory();
  const canCreateTransfer = user?.role === 'Admin' || user?.role === 'WarehouseKeeper';

  const [filters, setFilters] = useState<WarehouseReportFilters>(() => ({
    ...defaultDashboardDates(),
    regionId: '',
    top: DEFAULT_TOP,
    warehouseIds: [],
  }));
  const [initializedPick, setInitializedPick] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [activeTab, setActiveTab] = useState<'compare' | 'detail'>('compare');
  const [detailWarehouseId, setDetailWarehouseId] = useState('');
  const [sort, setSort] = useState<MetricSort>(null);
  const [selectedSkuRow, setSelectedSkuRow] = useState<SkuComparisonRow | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ warehouse: WarehouseReportWarehouse; product: WarehouseReportProductStock } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

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

  const scopedWarehouses = (warehouseList.data ?? []).filter((w) => {
    if (user?.role !== 'WarehouseKeeper') return true;
    const wIds = user.scope?.warehouseIds ?? [];
    const rIds = user.scope?.regionIds ?? [];
    if (wIds.length === 0 && rIds.length === 0) return false;
    return wIds.includes(w.id) || rIds.includes(w.regionId);
  });
  const options = selectableWarehouses(scopedWarehouses, filters.regionId);
  const picked = filters.warehouseIds ?? [];

  useEffect(() => {
    if (!initializedPick && options.length > 0) {
      setFilters((f) => ({ ...f, warehouseIds: options.slice(0, DEFAULT_PICKED_WAREHOUSES).map((w) => w.id) }));
      setInitializedPick(true);
    }
  }, [initializedPick, options]);

  const togglePicked = (id: string) =>
    setFilters((f) => {
      const ids = f.warehouseIds ?? [];
      return { ...f, warehouseIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(0, MAX_WAREHOUSES) };
    });

  const report = useQuery({
    queryKey: ['warehouse-logistics-report', user?.id, filters],
    queryFn: () => loadReport(filters),
    enabled: !invalid && !!user && picked.length > 0,
  });

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
          <div className="wr-chips">
            {canCreateTransfer && (
              <Button variant="primary" onClick={() => history.push('/warehouse-transfers/new')}>
                Tạo phiếu điều chuyển
              </Button>
            )}
            <Button disabled={!!invalid || !report.data || report.isFetching} loading={exporting} onClick={() => void exportExcel()}>
              Xuất Excel
            </Button>
          </div>
        }
      />
      {exportError && <Callout tone="danger">{exportError}</Callout>}

      <div className="card wr-filters">
        <label className="lbl">
          Từ ngày
          <DateInput required value={filters.fromDate} onChange={(fromDate) => setFilters((f) => ({ ...f, fromDate }))} />
        </label>
        <label className="lbl">
          Đến ngày
          <DateInput required min={filters.fromDate} value={filters.toDate} onChange={(toDate) => setFilters((f) => ({ ...f, toDate }))} />
        </label>
        <label className="lbl">
          Khu vực
          <select
            className="inp"
            value={filters.regionId}
            onChange={(e) => {
              const regionId = e.target.value;
              const nextOptions = selectableWarehouses(scopedWarehouses, regionId);
              const kept = keepSelectable(filters.warehouseIds ?? [], nextOptions);
              setFilters((f) => ({
                ...f,
                regionId,
                warehouseIds: kept.length > 0 ? kept : nextOptions.slice(0, DEFAULT_PICKED_WAREHOUSES).map((w) => w.id),
              }));
            }}
          >
            <option value="">Tất cả khu vực</option>
            {regions.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="lbl">
          So sánh SKU
          <select className="inp" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
            <option value="">Tất cả SKU đang hiển thị</option>
            {(report.data?.topProducts ?? []).map((p) => (
              <option key={p.productId} value={p.productId}>{p.sku} · {p.name}</option>
            ))}
          </select>
        </label>
        <label className="lbl">
          Phạm vi SKU
          <select
            className="inp"
            value={filters.allSkus ? 'all' : filters.top}
            onChange={(e) => {
              const v = e.target.value;
              setFilters((f) => (v === 'all' ? { ...f, allSkus: true } : { ...f, allSkus: false, top: Number(v) }));
            }}
          >
            {TOP_OPTIONS.map((n) => <option key={n} value={n}>Top {n} bán chạy</option>)}
            <option value="all">Tất cả SKU có tồn / biến động</option>
          </select>
        </label>
        <div className="wr-filter-actions">
          <Button onClick={() => setPickerOpen(true)} disabled={options.length === 0}>
            Chọn kho ({formatNumber(picked.length)}/{formatNumber(options.length)})
          </Button>
          <Button onClick={() => void report.refetch()} loading={report.isFetching} disabled={!!invalid || picked.length === 0}>
            Làm mới
          </Button>
        </div>
      </div>

      {regions.isError && (
        <Callout tone="danger">
          Không tải được danh sách khu vực.{'\n'}{errorMessage(regions.error)} <Button size="sm" onClick={() => void regions.refetch()}>Thử lại</Button>
        </Callout>
      )}

      {invalid ? (
        <Callout tone="danger">{invalid}</Callout>
      ) : picked.length === 0 ? (
        <EmptyState
          title="Chưa chọn kho hiển thị."
          description="Nhấn nút “Chọn kho” trên thanh lọc để chọn các kho cần so sánh."
          action={<Button variant="primary" onClick={() => setPickerOpen(true)}>Chọn kho ngay</Button>}
        />
      ) : (
        <QueryState query={report}>
          {(data) => {
            const comparisons = buildSkuComparisons(data);
            const filteredComparisons = selectedProductId ? comparisons.filter((c) => c.productId === selectedProductId) : comparisons;
            const warehouseChartData = buildWarehouseChartData(data, selectedProductId || undefined);
            const skuChartData = comparisons.slice(0, 10).map((c) => ({
              sku: c.sku,
              name: c.name,
              totalValid: c.totalValid,
              totalNearExpiry: c.totalNearExpiry,
              totalSales: c.totalSales,
            }));
            const totalValid = filteredComparisons.reduce((s, c) => s + c.totalValid, 0);
            const totalNear = filteredComparisons.reduce((s, c) => s + c.totalNearExpiry, 0);
            const totalSales = filteredComparisons.reduce((s, c) => s + c.totalSales, 0);
            const transferOpportunities = filteredComparisons.filter((c) => c.transferSuggestion !== null).length;

            const detailRows = data.warehouses
              .filter((w) => !detailWarehouseId || w.id === detailWarehouseId)
              .flatMap((w) =>
                sortProducts(
                  selectedProductId ? w.products.filter((p) => p.productId === selectedProductId) : w.products,
                  sort,
                ).map((p) => ({ warehouse: w, product: p })),
              );

            return (
              <>
                <div className="wr-summary">
                  <Stat label="Tổng tồn còn hạn" value={formatNumber(totalValid)} />
                  <Stat label="Tổng xuất bán trong kỳ" value={formatNumber(totalSales)} />
                  <Stat label="Tồn cận hạn cần đẩy" value={formatNumber(totalNear)} />
                  <Stat label="Gợi ý điều chuyển" value={formatNumber(transferOpportunities)} />
                </div>

                <div className="wr-charts">
                  <Card
                    title={
                      <h2 className="sec">
                        So sánh Tồn kho vs. Xuất bán theo Kho
                        {selectedProductId ? ` (${comparisons.find((c) => c.productId === selectedProductId)?.sku ?? ''})` : ''}
                      </h2>
                    }
                    actions={<Chip tone="neutral">{formatNumber(warehouseChartData.length)} kho</Chip>}
                  >
                    <div className="wr-chart-box">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={warehouseChartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                          <CartesianGrid stroke="#e3e9e7" strokeDasharray="3 3" />
                          <XAxis dataKey="code" />
                          <YAxis width={56} />
                          <Tooltip formatter={(value) => formatNumber(Number(value ?? 0))} />
                          <Legend />
                          <Bar dataKey="valid" name="Tồn còn hạn" fill="#15703a" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="nearExpiry" name="Tồn cận hạn" fill="#d97706" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="salesIssue" name="Xuất bán trong kỳ" fill="#6b2fbf" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card
                    title={<h2 className="sec">Top SKU Tồn kho vs. Bán chạy</h2>}
                    actions={<Chip tone="info">{formatNumber(skuChartData.length)} SKU</Chip>}
                  >
                    <div className="wr-chart-box">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={skuChartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                          <CartesianGrid stroke="#e3e9e7" strokeDasharray="3 3" />
                          <XAxis dataKey="sku" />
                          <YAxis width={56} />
                          <Tooltip formatter={(value) => formatNumber(Number(value ?? 0))} />
                          <Legend />
                          <Bar dataKey="totalValid" name="Tổng tồn còn hạn" fill="#15703a" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="totalSales" name="Tổng xuất bán" fill="#6b2fbf" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>

                <div className="wr-tabs" role="tablist" aria-label="Chế độ xem bảng báo cáo">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'compare'}
                    className={`wr-tab${activeTab === 'compare' ? ' active' : ''}`}
                    onClick={() => setActiveTab('compare')}
                  >
                    So sánh SKU &amp; Gợi ý điều chuyển ({formatNumber(filteredComparisons.length)})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'detail'}
                    className={`wr-tab${activeTab === 'detail' ? ' active' : ''}`}
                    onClick={() => setActiveTab('detail')}
                  >
                    Bảng chi tiết theo Kho × SKU ({formatNumber(detailRows.length)})
                  </button>
                </div>

                {activeTab === 'compare' ? (
                  <Card
                    flush
                    title={<h2 className="sec">So sánh tồn kho &amp; sức bán theo SKU để điều chuyển</h2>}
                    actions={
                      selectedProductId && (
                        <Button size="sm" onClick={() => setSelectedProductId('')}>Xem tất cả SKU</Button>
                      )
                    }
                  >
                    {filteredComparisons.length === 0 ? (
                      <EmptyState title="Chưa có dữ liệu SKU trong kỳ đã chọn." />
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="tbl compact">
                          <thead>
                            <tr>
                              <th className="wr-center">#</th>
                              <th>SKU · Sản phẩm</th>
                              <th>Kho tồn nhiều nhất</th>
                              <th>Kho bán chạy nhất</th>
                              <th>Gợi ý điều chuyển</th>
                              <th>Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredComparisons.map((row) => (
                              <tr key={row.productId}>
                                <td className="wr-center">{row.rank}</td>
                                <td className="wr-product" title={`${row.sku} · ${row.name}`}>
                                  <span className="bold">{row.sku}</span>
                                  <span className="muted small">{row.name}</span>
                                </td>
                                <td>
                                  {row.highestStock ? (
                                    <div className="wr-cell-stack">
                                      <span className="bold">{row.highestStock.code} · {row.highestStock.name}</span>
                                      <div className="wr-chips">
                                        <Qty value={row.highestStock.valid} tone="valid" />
                                        {row.highestStock.nearExpiry > 0 && <Qty value={row.highestStock.nearExpiry} tone="near" />}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="muted">Không có tồn</span>
                                  )}
                                </td>
                                <td>
                                  {row.topSales ? (
                                    <div className="wr-cell-stack">
                                      <span className="bold">{row.topSales.code} · {row.topSales.name}</span>
                                      <div className="wr-chips">
                                        <Qty value={row.topSales.salesIssue} tone="out-sales" />
                                        <span className="muted small">(tồn: {formatNumber(row.topSales.valid)})</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="muted">Chưa có xuất bán</span>
                                  )}
                                </td>
                                <td>
                                  {row.transferSuggestion ? (
                                    <span className="wr-transfer-pill">
                                      {row.transferSuggestion.fromCode} → {row.transferSuggestion.toCode}
                                    </span>
                                  ) : (
                                    <span className="muted small">Cân đối</span>
                                  )}
                                </td>
                                <td>
                                  <div className="wr-chips">
                                    <Button size="sm" onClick={() => setSelectedSkuRow(row)}>So sánh kho</Button>
                                    {canCreateTransfer && row.transferSuggestion && (
                                      <Button size="sm" variant="primary" onClick={() => history.push('/warehouse-transfers/new')}>
                                        Điều chuyển
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                ) : (
                  <Card
                    flush
                    title={<h2 className="sec">Chi tiết tồn kho &amp; xuất nhập theo Kho</h2>}
                    actions={
                      <select
                        className="inp"
                        style={{ minWidth: 210 }}
                        value={detailWarehouseId}
                        onChange={(e) => setDetailWarehouseId(e.target.value)}
                      >
                        <option value="">Tất cả kho đã chọn ({data.warehouses.length})</option>
                        {data.warehouses.map((w) => (
                          <option key={w.id} value={w.id}>{w.code} · {w.name}</option>
                        ))}
                      </select>
                    }
                  >
                    {detailRows.length === 0 ? (
                      <EmptyState title="Chưa có dữ liệu tồn kho hoặc xuất nhập." />
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="tbl compact wr-grid">
                          <thead>
                            <tr>
                              <th rowSpan={2}>Kho</th>
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
                                      title={`${m.hint}. Nhấn để sắp xếp`}
                                      onClick={() => setSort((s) => nextSort(s, m.key))}
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
                            {detailRows.map(({ warehouse, product }) => (
                              <tr key={`${warehouse.id}-${product.productId}`} className="clickable" onClick={() => setSelectedCell({ warehouse, product })}>
                                <td>
                                  <span className="bold">{warehouse.code}</span>
                                  <div className="muted small">{warehouse.name}</div>
                                </td>
                                <td className="wr-product" title={`${product.sku} · ${product.name}`}>
                                  <span className="bold">{product.sku}</span>
                                  <span className="muted small">{product.name}</span>
                                </td>
                                {METRICS.map((m) => (
                                  <td key={m.key} className="wr-right"><Qty value={product[m.key]} tone={m.tone} /></td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                )}
              </>
            );
          }}
        </QueryState>
      )}

      <Modal
        open={pickerOpen}
        width={760}
        title={`Chọn kho so sánh · Đã chọn ${formatNumber(picked.length)} / ${formatNumber(options.length)}`}
        onClose={() => setPickerOpen(false)}
        footer={
          <div className="wr-chips">
            <Button size="sm" disabled={options.length === 0} onClick={() => setFilters((f) => ({ ...f, warehouseIds: options.slice(0, MAX_WAREHOUSES).map((w) => w.id) }))}>
              Chọn tất cả
            </Button>
            <Button size="sm" disabled={picked.length === 0} onClick={() => setFilters((f) => ({ ...f, warehouseIds: [] }))}>
              Bỏ chọn
            </Button>
            <Button variant="primary" onClick={() => setPickerOpen(false)}>Xong</Button>
          </div>
        }
      >
        <QueryState query={warehouseList}>
          {() => options.length === 0 ? (
            <p className="muted">Không có kho đang hoạt động trong khu vực đã chọn.</p>
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
      </Modal>

      <Modal
        open={!!selectedSkuRow}
        width={820}
        title={selectedSkuRow ? `So sánh các kho · ${selectedSkuRow.sku} · ${selectedSkuRow.name}` : ''}
        subtitle={`${formatDate(filters.fromDate)} – ${formatDate(filters.toDate)}`}
        onClose={() => setSelectedSkuRow(null)}
        footer={
          <div className="wr-chips">
            {canCreateTransfer && selectedSkuRow?.transferSuggestion && (
              <Button variant="primary" onClick={() => history.push('/warehouse-transfers/new')}>
                Tạo phiếu điều chuyển ({selectedSkuRow.transferSuggestion.fromCode} → {selectedSkuRow.transferSuggestion.toCode})
              </Button>
            )}
            <Button onClick={() => setSelectedSkuRow(null)}>Đóng</Button>
          </div>
        }
      >
        {selectedSkuRow && (
          <table className="tbl compact">
            <thead>
              <tr>
                <th>Kho</th>
                <th className="wr-right">Còn hạn</th>
                <th className="wr-right">Cận hạn</th>
                <th className="wr-right">Xuất bán</th>
                <th className="wr-right">Nhập nhà máy</th>
                <th className="wr-right">Tồn vật lý</th>
              </tr>
            </thead>
            <tbody>
              {selectedSkuRow.slices.map((s) => (
                <tr key={s.warehouseId}>
                  <td><b>{s.code}</b> · {s.name}</td>
                  <td className="wr-right"><Qty value={s.valid} tone="valid" /></td>
                  <td className="wr-right"><Qty value={s.nearExpiry} tone="near" /></td>
                  <td className="wr-right"><Qty value={s.salesIssue} tone="out-sales" /></td>
                  <td className="wr-right"><Qty value={s.product.factoryReceipt} tone="in-factory" /></td>
                  <td className="wr-right">{formatNumber(s.onHand)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>

      <Modal
        open={!!selectedCell}
        width={760}
        title={selectedCell ? `${selectedCell.product.sku} · ${selectedCell.product.name}` : ''}
        subtitle={selectedCell ? `${selectedCell.warehouse.code} · ${selectedCell.warehouse.name} · ${formatDate(filters.fromDate)} – ${formatDate(filters.toDate)}` : undefined}
        onClose={() => setSelectedCell(null)}
        footer={<Button onClick={() => setSelectedCell(null)}>Đóng</Button>}
      >
        {selectedCell && (
          <div className="stack" style={{ gap: 16 }}>
            <Fields
              cols={3}
              items={[
                { label: 'Hạng bán chạy', value: `#${selectedCell.product.rank}` },
                { label: 'Tồn vật lý hiện tại', value: formatNumber(selectedCell.product.onHand) },
                { label: 'Khu vực', value: selectedCell.warehouse.regionName || '—' },
              ]}
            />
            <div className="wr-chips">
              <Chip tone="info">{formatNumber(selectedCell.warehouse.driverCount)} tài xế</Chip>
              <Chip tone="info">{formatNumber(selectedCell.warehouse.vehicleCount)} xe</Chip>
            </div>
            {(Object.keys(GROUP_LABELS) as MetricGroup[]).map((group) => (
              <div key={group}>
                <h3 className="sec" style={{ marginBottom: 8 }}>{GROUP_LABELS[group]}</h3>
                <Fields
                  cols={METRICS.filter((m) => m.group === group).length > 2 ? 3 : 2}
                  items={METRICS.filter((m) => m.group === group).map((m) => ({
                    label: m.label,
                    value: <span title={m.hint}><Qty value={selectedCell.product[m.key]} tone={m.tone} /></span>,
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
