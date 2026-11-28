import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, getAll } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { useLocation, useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, DateInput, Fields, Modal, PageHeader, Pagination, QueryState, SimpleTable, Stat, StatusChip } from '@/shared/ui';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { downloadExcel } from '@/shared/lib/excel';
import { defaultDashboardDates } from '@/features/dashboard/dashboardModel';
import { useAuth } from '@/shared/auth/AuthContext';
import { loadAllReportRows } from './reportExport';
import { labelOf, rangeError, REPORT_TITLES } from './reportLayout';
import { ExportErrorCallout, ReportNotes, useDebounced } from './reportShared';
import type { PromotionsReportResult, PromotionUsageItem } from './types';

export function PromotionsReportView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = new URLSearchParams(useLocation().search);
  const isGlobal = user?.role === 'Admin' || user?.role === 'Operator';

  const [viewMode, setViewMode] = useState<'programs' | 'orders'>(params.get('program') ? 'orders' : 'programs');
  const [draft, setDraft] = useState(() => ({
    ...defaultDashboardDates(),
    regionId: '',
    retailer: '',
    program: params.get('program') ?? '',
    discountType: '',
    completedOnly: false,
  }));
  const filters = useDebounced(draft, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [selected, setSelected] = useState<PromotionUsageItem | null>(null);

  useEffect(() => { setPage(1); }, [filters]);

  const invalid = rangeError(filters.fromDate, filters.toDate);
  const regions = useQuery({
    queryKey: ['report-regions', user?.id],
    queryFn: () => getAll<{ id: string; name: string }>('/regions', { includeInactive: true }),
    enabled: !!user,
  });

  const load = (p: number, ps: number) => get<PromotionsReportResult>('/reports/promotions', {
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    regionId: filters.regionId || undefined,
    retailer: filters.retailer || undefined,
    program: filters.program || undefined,
    discountType: filters.discountType || undefined,
    completedOnly: filters.completedOnly || undefined,
    page: p,
    pageSize: ps,
  });

  const query = useQuery({
    queryKey: ['business-report-promotions', user?.id, user?.role, filters, page, pageSize],
    queryFn: () => load(page, pageSize),
    enabled: !invalid && !!user,
  });

  async function exportExcel() {
    if (!query.data) return;
    setExporting(true); setExportError('');
    try {
      const items = await loadAllReportRows<PromotionUsageItem>(async (p, size) => (await load(p, size)).items);
      const info = [`Kỳ: ${formatDate(filters.fromDate)} – ${formatDate(filters.toDate)}`, `Phạm vi: ${query.data.scope}`];
      await downloadExcel(`bao-cao-khuyen-mai-${filters.fromDate}-${filters.toDate}.xlsx`, [
        {
          name: 'Theo chương trình',
          title: 'Tổng hợp theo chương trình khuyến mãi & giảm HSD',
          info,
          blocks: [{
            columns: [
              { header: 'Mã CTKM / HSD', width: 20 }, { header: 'Tên chương trình', width: 32 }, { header: 'Phân loại', width: 16 },
              { header: 'Tổng đơn', numeric: true }, { header: 'Đơn hoàn tất', numeric: true }, { header: 'Sản lượng (thùng)', numeric: true },
              { header: 'Trước giảm (đ)', numeric: true, width: 18 }, { header: 'Giảm CTKM (đ)', numeric: true, width: 18 },
              { header: 'Giảm HSD (đ)', numeric: true, width: 18 }, { header: 'Tổng giảm (đ)', numeric: true, width: 18 },
              { header: 'Tỷ lệ giảm (%)', numeric: true }, { header: 'Sau giảm (đ)', numeric: true, width: 18 },
            ],
            rows: query.data.byProgram.map(p => [
              p.programCode, p.programName, labelOf(p.discountType), p.orderCount, p.completedOrderCount,
              p.totalQuantity, p.grossAmount, p.campaignDiscountAmount, p.shelfLifeDiscountAmount,
              p.discountAmount, p.discountRatePercent, p.netAmount,
            ]),
          }],
        },
        {
          name: 'Chi tiết theo đơn hàng',
          title: 'Chi tiết dòng hàng áp dụng khuyến mãi',
          info,
          blocks: [{
            columns: [
              { header: 'Thời điểm duyệt BG', width: 18 }, { header: 'Đơn hàng', width: 16 }, { header: 'Trạng thái đơn', width: 16 },
              { header: 'Nhà bán lẻ', width: 26 }, { header: 'Mã CTKM', width: 20 }, { header: 'SKU', width: 14 },
              { header: 'Sản phẩm', width: 28 }, { header: 'Lô', width: 16 }, { header: 'SL', numeric: true },
              { header: 'Trước giảm (đ)', numeric: true, width: 16 }, { header: 'Giảm CTKM (đ)', numeric: true, width: 16 },
              { header: 'Giảm HSD (đ)', numeric: true, width: 16 }, { header: 'Tổng giảm (đ)', numeric: true, width: 16 },
              { header: 'Sau giảm (đ)', numeric: true, width: 16 },
            ],
            rows: items.map(i => [
              formatInstantDateTime(i.acceptedAt), i.orderCode, labelOf(i.orderStatus), `${i.retailerCode} · ${i.retailerName}`,
              i.programCode, i.sku, i.productName, i.batchCode, i.quantity, i.grossAmount,
              i.campaignDiscountAmount, i.shelfLifeDiscountAmount, i.totalDiscountAmount, i.netAmount,
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
        title={REPORT_TITLES.promotions}
        actions={
          <Button disabled={!!invalid || !query.data || query.isFetching} loading={exporting} onClick={() => void exportExcel()}>
            Xuất Excel
          </Button>
        }
      />

      <div className="card report-filters">
        <label className="lbl">Từ ngày<DateInput required value={draft.fromDate} onChange={fromDate => setDraft(f => ({ ...f, fromDate }))} /></label>
        <label className="lbl">Đến ngày<DateInput required min={draft.fromDate} value={draft.toDate} onChange={toDate => setDraft(f => ({ ...f, toDate }))} /></label>
        <label className="lbl">Khu vực
          <select className="inp" value={draft.regionId} onChange={e => setDraft(f => ({ ...f, regionId: e.target.value }))}>
            <option value="">Tất cả khu vực</option>
            {regions.data?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="lbl">Nhà bán lẻ<input className="inp" placeholder="Mã hoặc tên NBL..." value={draft.retailer} onChange={e => setDraft(f => ({ ...f, retailer: e.target.value }))} /></label>
        <label className="lbl">Chương trình / SKU<input className="inp" placeholder="Mã CTKM, HSD, SKU, đơn..." value={draft.program} onChange={e => setDraft(f => ({ ...f, program: e.target.value }))} /></label>
        <label className="lbl">Loại ưu đãi
          <select className="inp" value={draft.discountType} onChange={e => setDraft(f => ({ ...f, discountType: e.target.value }))}>
            <option value="">Tất cả</option>
            <option value="Campaign">Chiến dịch KM</option>
            <option value="ShelfLife">Giảm theo HSD</option>
            <option value="Combined">Kết hợp CTKM + HSD</option>
          </select>
        </label>
        <label className="lbl" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', paddingTop: 18 }}>
          <input type="checkbox" checked={draft.completedOnly} onChange={e => setDraft(f => ({ ...f, completedOnly: e.target.checked }))} />
          <span>Chỉ đơn Hoàn tất</span>
        </label>
        <Button onClick={() => void query.refetch()} loading={query.isFetching} disabled={!!invalid}>Làm mới</Button>
      </div>

      <ExportErrorCallout message={exportError} />
      {invalid ? <Callout tone="danger">{invalid}</Callout> : (
        <QueryState query={query}>
          {data => {
            const s = data.summary;
            return (
              <>
                <div className="report-summary" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                  <Stat label="Đơn áp dụng (Hoàn tất)" value={`${formatNumber(s.appliedOrderCount)} (${formatNumber(s.completedOrderCount)})`} />
                  <Stat label="Giảm chiến dịch / Giảm HSD" value={`${formatMoney(s.campaignDiscountAmount)} / ${formatMoney(s.shelfLifeDiscountAmount)}`} />
                  <Stat label="Tổng tiền giảm (% trên Gross)" value={`${formatMoney(s.totalDiscountAmount)} (${formatNumber(s.effectiveDiscountRatePercent)}%)`} color="var(--c-danger, #b42318)" />
                  <Stat label="Doanh thu sau giảm (Hoàn tất)" value={`${formatMoney(s.netAmount)} (${formatMoney(s.completedNetAmount)})`} color="var(--c-primary, #14655b)" />
                </div>

                <div className="report-tabs-row" role="tablist">
                  <Button size="sm" variant={viewMode === 'programs' ? 'primary' : 'default'} onClick={() => setViewMode('programs')}>
                    Tổng hợp theo khuyến mãi ({formatNumber(data.byProgram.length)})
                  </Button>
                  <Button size="sm" variant={viewMode === 'orders' ? 'primary' : 'default'} onClick={() => setViewMode('orders')}>
                    Chi tiết các đơn hàng áp dụng ({formatNumber(data.items.totalCount)})
                  </Button>
                </div>

                {viewMode === 'programs' ? (
                  <Card title="Hiệu quả từng chương trình khuyến mãi & giảm HSD">
                    <div className="report-table">
                      <SimpleTable
                        rows={data.byProgram}
                        columns={[
                          { header: 'Mã CTKM', cell: p => <b>{p.programCode}</b> },
                          { header: 'Tên chương trình', cell: p => p.programName },
                          { header: 'Phân loại', cell: p => <StatusChip value={labelOf(p.discountType)} /> },
                          { header: 'Đơn (HT)', align: 'right', cell: p => `${formatNumber(p.orderCount)} (${formatNumber(p.completedOrderCount)})` },
                          { header: 'Sản lượng', align: 'right', cell: p => formatNumber(p.totalQuantity) },
                          { header: 'Giảm CTKM', align: 'right', cell: p => formatMoney(p.campaignDiscountAmount) },
                          { header: 'Giảm HSD', align: 'right', cell: p => formatMoney(p.shelfLifeDiscountAmount) },
                          { header: 'Tổng giảm (% Gross)', align: 'right', cell: p => <strong style={{ color: 'var(--c-danger, #b42318)' }}>{formatMoney(p.discountAmount)} ({p.discountRatePercent}%)</strong> },
                          { header: 'Sau giảm', align: 'right', cell: p => formatMoney(p.netAmount) },
                          {
                            header: '', align: 'right',
                            cell: p => <Button size="sm" onClick={() => { setDraft(f => ({ ...f, program: p.programCode })); setViewMode('orders'); }}>Xem đơn</Button>,
                          },
                        ]}
                      />
                    </div>
                  </Card>
                ) : (
                  <Card title="Chi tiết dòng hàng áp dụng khuyến mãi">
                    <div className="report-table">
                      <SimpleTable
                        paginate={false}
                        rows={data.items.items}
                        onRowClick={setSelected}
                        columns={[
                          { header: 'Duyệt BG lúc', cell: i => formatInstantDateTime(i.acceptedAt) },
                          { header: 'Đơn hàng', cell: i => <b>{i.orderCode}</b> },
                          { header: 'Trạng thái', cell: i => <StatusChip value={labelOf(i.orderStatus)} /> },
                          { header: 'Nhà bán lẻ', cell: i => `${i.retailerCode} · ${i.retailerName}` },
                          { header: 'Chương trình', cell: i => i.programName },
                          { header: 'SKU', cell: i => i.sku },
                          { header: 'SL', align: 'right', cell: i => formatNumber(i.quantity) },
                          { header: 'Tiền giảm', align: 'right', cell: i => <strong style={{ color: 'var(--c-danger, #b42318)' }}>{formatMoney(i.totalDiscountAmount)}</strong> },
                          { header: 'Sau giảm', align: 'right', cell: i => formatMoney(i.netAmount) },
                          ...(isGlobal ? [{
                            header: '', align: 'right' as const,
                            cell: (i: PromotionUsageItem) => (
                              <div className="report-actions" onClick={e => e.stopPropagation()}>
                                <Button size="sm" onClick={() => navigate(`/orders/${i.orderId}`)}>Đơn hàng</Button>
                              </div>
                            ),
                          }] : []),
                        ]}
                      />
                    </div>
                    <Pagination
                      currentPage={data.items.page}
                      totalCount={data.items.totalCount}
                      pageSize={data.items.pageSize}
                      itemCount={data.items.items.length}
                      totalPages={Math.max(1, Math.ceil(data.items.totalCount / data.items.pageSize))}
                      loading={query.isFetching}
                      hasPrev={data.items.page > 1}
                      hasNext={data.items.page * data.items.pageSize < data.items.totalCount}
                      onPage={setPage}
                      onPrev={() => setPage(p => p - 1)}
                      onNext={() => setPage(p => p + 1)}
                      onPageSizeChange={size => { setPageSize(size); setPage(1); }}
                    />
                  </Card>
                )}

                <ReportNotes scope={data.scope} notes={data.notes} />
              </>
            );
          }}
        </QueryState>
      )}

      <Modal open={!!selected} width={820} title={selected ? `Chi tiết áp dụng · ${selected.orderCode} · ${selected.sku}` : ''} onClose={() => setSelected(null)} footer={<Button onClick={() => setSelected(null)}>Đóng</Button>}>
        {selected && (
          <Fields cols={3} items={[
            { label: 'Đơn hàng', value: `${selected.orderCode} (${labelOf(selected.orderStatus)})` },
            { label: 'Nhà bán lẻ', value: `${selected.retailerCode} · ${selected.retailerName}` },
            { label: 'Chương trình', value: `${selected.programCode} · ${selected.programName}` },
            { label: 'SKU / Sản phẩm', value: `${selected.sku} · ${selected.productName}` },
            { label: 'Lô hàng', value: selected.batchCode },
            { label: 'Số lượng', value: `${formatNumber(selected.quantity)} thùng` },
            { label: 'Đơn giá niêm yết', value: formatMoney(selected.listUnitPrice) },
            { label: 'Giảm chiến dịch', value: formatMoney(selected.campaignDiscountAmount) },
            { label: 'Giảm theo HSD', value: formatMoney(selected.shelfLifeDiscountAmount) },
            { label: 'Thành tiền trước giảm', value: formatMoney(selected.grossAmount) },
            { label: 'Tổng giảm', value: formatMoney(selected.totalDiscountAmount) },
            { label: 'Thành tiền sau giảm', value: formatMoney(selected.netAmount) },
            { label: 'Diễn giải giá hệ thống', value: selected.explanation || '—' },
          ]} />
        )}
      </Modal>
    </>
  );
}
