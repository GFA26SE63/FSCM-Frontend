import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, getAll } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, Chip, DateInput, PageHeader, Pagination, QueryState, SimpleTable, Stat, StatusChip } from '@/shared/ui';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { downloadExcel } from '@/shared/lib/excel';
import { defaultDashboardDates } from '@/features/dashboard/dashboardModel';
import { useAuth } from '@/shared/auth/AuthContext';
import { loadAllReportRows } from './reportExport';
import { labelOf, rangeError, REPORT_TITLES } from './reportLayout';
import { ExportErrorCallout, ReportNotes, useDebounced } from './reportShared';
import type { DisposalReportItem, ExpiryActionBatchItem, InventoryLockReportItem, InventoryRiskReportResult } from './types';

type Tab = 'expiry' | 'locks' | 'disposals';

export function InventoryRiskReportView({ initialTab = 'expiry' }: { initialTab?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>(
    initialTab === 'locks' || initialTab === 'disposals' ? initialTab : 'expiry',
  );
  const [draft, setDraft] = useState(() => ({
    ...defaultDashboardDates(),
    regionId: '',
    warehouseId: '',
    search: '',
    status: '',
  }));
  const filters = useDebounced(draft, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => { setPage(1); }, [tab, filters]);

  const invalid = rangeError(filters.fromDate, filters.toDate);
  const regions = useQuery({
    queryKey: ['report-regions', user?.id],
    queryFn: () => getAll<{ id: string; name: string }>('/regions', { includeInactive: true }),
    enabled: !!user,
  });
  const warehouses = useQuery({
    queryKey: ['report-warehouses', user?.id],
    queryFn: () => getAll<{ id: string; code: string; name: string; regionId: string }>('/warehouses'),
    enabled: !!user,
  });

  const load = (t: Tab, p: number, ps: number) => get<InventoryRiskReportResult>('/reports/inventory-risk', {
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    tab: t,
    regionId: filters.regionId || undefined,
    warehouseId: filters.warehouseId || undefined,
    search: filters.search || undefined,
    status: filters.status || undefined,
    page: p,
    pageSize: ps,
  });

  const query = useQuery({
    queryKey: ['business-report-inventory-risk', user?.id, user?.role, tab, filters, page, pageSize],
    queryFn: () => load(tab, page, pageSize),
    enabled: !invalid && !!user,
  });

  async function exportExcel() {
    if (!query.data) return;
    setExporting(true); setExportError('');
    try {
      const [expiry, locks, disposals] = await Promise.all([
        loadAllReportRows<ExpiryActionBatchItem>(async (p, size) => (await load('expiry', p, size)).expiry),
        loadAllReportRows<InventoryLockReportItem>(async (p, size) => (await load('locks', p, size)).locks),
        loadAllReportRows<DisposalReportItem>(async (p, size) => (await load('disposals', p, size)).disposals),
      ]);
      const info = [`Kỳ: ${formatDate(filters.fromDate)} – ${formatDate(filters.toDate)}`, `Phạm vi: ${query.data.scope}`];
      await downloadExcel(`bao-cao-rui-ro-ton-kho-${filters.fromDate}-${filters.toDate}.xlsx`, [
        {
          name: 'Cận hạn & Hết hạn',
          title: 'Danh sách lô hàng cận hạn / hết hạn cần xử lý',
          info,
          blocks: [{
            columns: [
              { header: 'Kho', width: 14 }, { header: 'Mã lô', width: 16 }, { header: 'SKU', width: 14 },
              { header: 'Sản phẩm', width: 28 }, { header: 'HSD', width: 14 }, { header: 'Còn lại (ngày)', numeric: true },
              { header: 'Trạng thái', width: 14 }, { header: 'Tồn vật lý', numeric: true }, { header: 'Khả dụng', numeric: true },
              { header: 'Giảm HSD', width: 12 }, { header: 'Giá trị rủi ro (đ)', numeric: true, width: 18 },
            ],
            rows: expiry.map(e => [
              e.warehouseCode, e.batchCode, e.sku, e.productName, formatDate(e.expirationDate), e.daysUntilExpiry,
              labelOf(e.expiryStatus), e.physicalQuantity, e.availableQuantity, e.hasActiveBatchPromo ? 'Đã bật' : 'Chưa bật', e.estimatedAtRiskValue,
            ]),
          }],
        },
        {
          name: 'Khóa tồn kho',
          title: 'Tồn kho đang khóa / cách ly',
          info,
          blocks: [{
            columns: [
              { header: 'Kho', width: 14 }, { header: 'Mã lô', width: 16 }, { header: 'SKU', width: 14 },
              { header: 'SL khóa', numeric: true }, { header: 'Lý do', width: 18 }, { header: 'Cần xử lý', width: 12 },
              { header: 'Trạng thái', width: 14 }, { header: 'Số ngày mở', numeric: true }, { header: 'Giá trị (đ)', numeric: true, width: 18 },
            ],
            rows: locks.map(l => [
              l.warehouseCode, l.batchCode, l.sku, l.lockedQuantity, labelOf(l.reason),
              l.requiresResolution ? 'Có' : 'Không', labelOf(l.status), l.daysOpen, l.estimatedValue,
            ]),
          }],
        },
        {
          name: 'Biên bản tiêu hủy',
          title: 'Chi tiết tiêu hủy & tổn thất trong kỳ',
          info,
          blocks: [{
            columns: [
              { header: 'Ngày lập', width: 18 }, { header: 'Mã phiếu hủy', width: 16 }, { header: 'Kho', width: 16 },
              { header: 'Mã lô', width: 16 }, { header: 'SKU', width: 14 }, { header: 'Sản phẩm', width: 28 },
              { header: 'SL hủy', numeric: true }, { header: 'Đơn giá (đ)', numeric: true, width: 16 },
              { header: 'Tổn thất (đ)', numeric: true, width: 18 }, { header: 'Hình thức', width: 18 }, { header: 'Người lập', width: 20 },
            ],
            rows: disposals.map(d => [
              formatInstantDateTime(d.createdAt), d.writeOffCode, `${d.warehouseCode} · ${d.warehouseName}`,
              d.batchCode, d.sku, d.productName, d.quantity, d.unitPriceAtWriteOff, d.lossAmount, d.disposalMethod, d.createdByName ?? '—',
            ]),
          }],
        },
      ]);
    } catch (err) { setExportError(errorMessage(err)); }
    finally { setExporting(false); }
  }

  return (
    <>
      <PageHeader
        title={REPORT_TITLES['inventory-risk']}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => navigate('/disposal/new')}>Lập phiếu hủy</Button>
            <Button disabled={!!invalid || !query.data || query.isFetching} loading={exporting} onClick={() => void exportExcel()}>
              Xuất Excel
            </Button>
          </div>
        }
      />

      <div className="card report-filters">
        <label className="lbl">Từ ngày<DateInput required value={draft.fromDate} onChange={fromDate => setDraft(f => ({ ...f, fromDate }))} /></label>
        <label className="lbl">Đến ngày<DateInput required min={draft.fromDate} value={draft.toDate} onChange={toDate => setDraft(f => ({ ...f, toDate }))} /></label>
        <label className="lbl">Khu vực
          <select className="inp" value={draft.regionId} onChange={e => setDraft(f => ({ ...f, regionId: e.target.value, warehouseId: '' }))}>
            <option value="">Tất cả khu vực</option>
            {regions.data?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="lbl">Kho
          <select className="inp" value={draft.warehouseId} onChange={e => setDraft(f => ({ ...f, warehouseId: e.target.value }))}>
            <option value="">Tất cả kho</option>
            {warehouses.data?.filter(w => !draft.regionId || w.regionId === draft.regionId).map(w => (
              <option key={w.id} value={w.id}>{w.code} · {w.name}</option>
            ))}
          </select>
        </label>
        <label className="lbl">Lô / SKU / Phiếu<input className="inp" placeholder="Mã lô, SKU, mã phiếu hủy..." value={draft.search} onChange={e => setDraft(f => ({ ...f, search: e.target.value }))} /></label>
        <Button onClick={() => void query.refetch()} loading={query.isFetching} disabled={!!invalid}>Làm mới</Button>
      </div>

      <ExportErrorCallout message={exportError} />
      {invalid ? <Callout tone="danger">{invalid}</Callout> : (
        <QueryState query={query}>
          {data => {
            const s = data.summary;
            const activePaged = tab === 'expiry' ? data.expiry : tab === 'locks' ? data.locks : data.disposals;
            return (
              <>
                <div className="report-summary" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                  <Stat label="Hàng cận hạn hiện tại" value={`${formatNumber(s.nearExpiryCartons)} thùng`} note={`${formatNumber(s.nearExpiryBatchCount)} lô`} color={s.nearExpiryCartons > 0 ? 'var(--c-warn, #8a3b09)' : undefined} />
                  <Stat label="Hàng hết hạn chưa hủy" value={`${formatNumber(s.expiredUnsoldCartons)} thùng`} note={`Ước tính rủi ro ${formatMoney(s.estimatedExpiryRiskValue)}`} color={s.expiredUnsoldCartons > 0 ? 'var(--c-danger, #b42318)' : undefined} />
                  <Stat label="Đang khóa / Cần xử lý" value={`${formatNumber(s.activeLockedCartons)} thùng`} note={`${formatNumber(s.activeLockCount)} lệnh · ${formatNumber(s.locksRequiringResolutionCount)} cần xử lý · ${formatMoney(s.estimatedLockedValue)}`} />
                  <Stat label="Tiêu hủy trong kỳ" value={`${formatNumber(s.disposedCartonsInPeriod)} thùng`} note={`${formatNumber(s.writeOffDocCount)} phiếu · Tổn thất ${formatMoney(s.estimatedWriteOffLossValue)}`} color="var(--c-danger, #b42318)" />
                </div>

                <div className="report-tabs-row" role="tablist">
                  <Button size="sm" variant={tab === 'expiry' ? 'primary' : 'default'} onClick={() => setTab('expiry')}>
                    Lô cận hạn &amp; hết hạn ({formatNumber(s.nearExpiryBatchCount + s.expiredUnsoldBatchCount)})
                  </Button>
                  <Button size="sm" variant={tab === 'locks' ? 'primary' : 'default'} onClick={() => setTab('locks')}>
                    Khóa tồn kho &amp; Cách ly ({formatNumber(s.activeLockCount)} Active)
                  </Button>
                  <Button size="sm" variant={tab === 'disposals' ? 'primary' : 'default'} onClick={() => setTab('disposals')}>
                    Biên bản tiêu hủy ({formatNumber(s.writeOffDocCount)})
                  </Button>
                </div>

                <Card title={tab === 'expiry' ? 'Hàng chờ đẩy HSD hoặc tiêu hủy' : tab === 'locks' ? 'Danh sách tồn kho đang khóa' : 'Lịch sử biên bản tiêu hủy trong kỳ'}>
                  <div className="report-table">
                    {tab === 'expiry' ? (
                      <SimpleTable
                        paginate={false}
                        rows={data.expiry.items}
                        columns={[
                          { header: 'Kho', cell: e => `${e.warehouseCode}` },
                          { header: 'Mã lô', cell: e => <b>{e.batchCode}</b> },
                          { header: 'SKU · Sản phẩm', cell: e => `${e.sku} · ${e.productName}` },
                          { header: 'HSD', cell: e => formatDate(e.expirationDate) },
                          { header: 'Còn lại', align: 'right', cell: e => (e.daysUntilExpiry < 0 ? <Chip tone="danger">Quá {-e.daysUntilExpiry} ngày</Chip> : `${e.daysUntilExpiry} ngày`) },
                          { header: 'Tồn / Khả dụng', align: 'right', cell: e => `${formatNumber(e.physicalQuantity)} / ${formatNumber(e.availableQuantity)}` },
                          { header: 'Giảm HSD', cell: e => (e.hasActiveBatchPromo ? <Chip tone="ok">Đã bật</Chip> : <Chip tone="warn">Chưa bật</Chip>) },
                          { header: 'Giá trị rủi ro', align: 'right', cell: e => <strong>{formatMoney(e.estimatedAtRiskValue)}</strong> },
                          { header: 'Trạng thái', cell: e => <StatusChip value={labelOf(e.expiryStatus)} /> },
                          {
                            header: '', align: 'right',
                            cell: e => e.expiryStatus === 'Expired'
                              ? <Button size="sm" onClick={() => navigate('/disposal/new')}>Hủy hàng</Button>
                              : <Button size="sm" onClick={() => navigate(`/batches/${encodeURIComponent(e.batchCode)}`)}>Xem lô</Button>,
                          },
                        ]}
                      />
                    ) : tab === 'locks' ? (
                      <SimpleTable
                        paginate={false}
                        rows={data.locks.items}
                        columns={[
                          { header: 'Kho', cell: l => l.warehouseCode },
                          { header: 'Mã lô', cell: l => <b>{l.batchCode}</b> },
                          { header: 'SKU', cell: l => l.sku },
                          { header: 'SL khóa', align: 'right', cell: l => <strong>{formatNumber(l.lockedQuantity)}</strong> },
                          { header: 'Lý do', cell: l => labelOf(l.reason) },
                          { header: 'Số ngày mở', align: 'right', cell: l => `${l.daysOpen} ngày` },
                          { header: 'Giá trị ước tính', align: 'right', cell: l => formatMoney(l.estimatedValue) },
                          { header: 'Trạng thái', cell: l => <StatusChip value={labelOf(l.status)} /> },
                          { header: 'Người khóa', cell: l => l.lockedByName ?? '—' },
                        ]}
                      />
                    ) : (
                      <SimpleTable
                        paginate={false}
                        rows={data.disposals.items}
                        columns={[
                          { header: 'Ngày lập', cell: d => formatInstantDateTime(d.createdAt) },
                          { header: 'Mã phiếu hủy', cell: d => <b>{d.writeOffCode}</b> },
                          { header: 'Kho', cell: d => `${d.warehouseCode} · ${d.warehouseName}` },
                          { header: 'Mã lô', cell: d => d.batchCode },
                          { header: 'SKU · Sản phẩm', cell: d => `${d.sku} · ${d.productName}` },
                          { header: 'SL hủy', align: 'right', cell: d => formatNumber(d.quantity) },
                          { header: 'Tổn thất (đ)', align: 'right', cell: d => <strong style={{ color: 'var(--c-danger, #b42318)' }}>{formatMoney(d.lossAmount)}</strong> },
                          { header: 'Hình thức', cell: d => d.disposalMethod },
                          {
                            header: '', align: 'right',
                            cell: d => <Button size="sm" onClick={() => navigate(`/disposal/${encodeURIComponent(d.writeOffCode)}`)}>Phiếu hủy</Button>,
                          },
                        ]}
                      />
                    )}
                  </div>
                  <Pagination
                    currentPage={activePaged.page}
                    totalCount={activePaged.totalCount}
                    pageSize={activePaged.pageSize}
                    itemCount={activePaged.items.length}
                    totalPages={Math.max(1, Math.ceil(activePaged.totalCount / activePaged.pageSize))}
                    loading={query.isFetching}
                    hasPrev={activePaged.page > 1}
                    hasNext={activePaged.page * activePaged.pageSize < activePaged.totalCount}
                    onPage={setPage}
                    onPrev={() => setPage(p => p - 1)}
                    onNext={() => setPage(p => p + 1)}
                    onPageSizeChange={size => { setPageSize(size); setPage(1); }}
                  />
                </Card>

                <ReportNotes scope={data.scope} notes={data.notes} />
              </>
            );
          }}
        </QueryState>
      )}
    </>
  );
}
