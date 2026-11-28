import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, getAll } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, Chip, DateInput, Fields, Modal, PageHeader, Pagination, QueryState, SimpleTable, Stat, StatusChip } from '@/shared/ui';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { downloadExcel } from '@/shared/lib/excel';
import { defaultDashboardDates } from '@/features/dashboard/dashboardModel';
import { useAuth } from '@/shared/auth/AuthContext';
import { loadAllReportRows } from './reportExport';
import { labelOf, rangeError, REPORT_TITLES } from './reportLayout';
import { ExportErrorCallout, ReportNotes, useDebounced } from './reportShared';
import type { ClaimReportItem, ClaimsReportResult } from './types';

const STATUSES = ['Open', 'UnderReview', 'CollectionPending', 'Resolved', 'Closed', 'Rejected', 'Cancelled'];

export function ClaimsReportView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isGlobal = user?.role === 'Admin' || user?.role === 'Operator';

  const [draft, setDraft] = useState(() => ({
    ...defaultDashboardDates(),
    regionId: '',
    retailer: '',
    search: '',
    requestType: '',
    status: '',
  }));
  const filters = useDebounced(draft, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [selected, setSelected] = useState<ClaimReportItem | null>(null);

  useEffect(() => { setPage(1); }, [filters]);

  const invalid = rangeError(filters.fromDate, filters.toDate);
  const regions = useQuery({
    queryKey: ['report-regions', user?.id],
    queryFn: () => getAll<{ id: string; name: string }>('/regions', { includeInactive: true }),
    enabled: !!user,
  });

  const load = (p: number, ps: number) => get<ClaimsReportResult>('/reports/claims', {
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    regionId: filters.regionId || undefined,
    retailer: filters.retailer || undefined,
    search: filters.search || undefined,
    requestType: filters.requestType || undefined,
    status: filters.status || undefined,
    page: p,
    pageSize: ps,
  });

  const query = useQuery({
    queryKey: ['business-report-claims', user?.id, user?.role, filters, page, pageSize],
    queryFn: () => load(page, pageSize),
    enabled: !invalid && !!user,
  });

  async function exportExcel() {
    if (!query.data) return;
    setExporting(true); setExportError('');
    try {
      const items = await loadAllReportRows<ClaimReportItem>(async (p, size) => (await load(p, size)).items);
      const info = [`Kỳ: ${formatDate(filters.fromDate)} – ${formatDate(filters.toDate)}`, `Phạm vi: ${query.data.scope}`];
      await downloadExcel(`bao-cao-khieu-nai-${filters.fromDate}-${filters.toDate}.xlsx`, [
        {
          name: 'Chi tiết khiếu nại',
          title: 'Báo cáo khiếu nại, trả hàng & hoàn tiền',
          info,
          blocks: [{
            columns: [
              { header: 'Mã KN', width: 14 }, { header: 'Tiếp nhận', width: 18 }, { header: 'Đơn hàng', width: 16 },
              { header: 'Nhà bán lẻ', width: 26 }, { header: 'Sales phụ trách', width: 20 }, { header: 'Kho xuất', width: 16 },
              { header: 'Loại YC', width: 18 }, { header: 'Xử lý tài chính', width: 18 }, { header: 'SL YC / Duyệt', width: 16 },
              { header: 'Cấn trừ công nợ (đ)', numeric: true, width: 18 }, { header: 'Hoàn tiền (đ)', numeric: true, width: 18 },
              { header: 'TT hoàn tiền', width: 18 }, { header: 'Trạng thái', width: 16 }, { header: 'SLA (giờ)', numeric: true },
            ],
            rows: items.map(c => [
              c.claimCode, formatInstantDateTime(c.reportedAt), c.orderCode, `${c.retailerCode} · ${c.retailerName}`,
              c.salesUserName, `${c.warehouseCode} · ${c.warehouseName}`, labelOf(c.requestType), labelOf(c.settlementMethod),
              `${formatNumber(c.requestedQuantity)} / ${c.approvedQuantity != null ? formatNumber(c.approvedQuantity) : '—'}`,
              c.debtOffsetAmount, c.refundAmount, c.refundStatus ? labelOf(c.refundStatus) : '—',
              labelOf(c.status), c.resolutionHours ?? null,
            ]),
          }],
        },
        {
          name: 'Theo kho giao hàng',
          title: 'Phân bổ khiếu nại theo kho giao hàng',
          info,
          blocks: [{
            columns: [
              { header: 'Mã kho', width: 14 }, { header: 'Kho', width: 28 }, { header: 'Số khiếu nại', numeric: true },
              { header: 'Đang mở', numeric: true }, { header: 'SL duyệt (thùng)', numeric: true }, { header: 'Tổng giá trị ĐC (đ)', numeric: true, width: 20 },
            ],
            rows: query.data.byWarehouse.map(w => [
              w.warehouseCode, w.warehouseName, w.claimCount, w.openCount, w.approvedQuantity, w.financialImpactAmount,
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
        title={REPORT_TITLES.claims}
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
        <label className="lbl">Mã KN / Đơn / Kho<input className="inp" placeholder="KN-..., SO-..., mã kho" value={draft.search} onChange={e => setDraft(f => ({ ...f, search: e.target.value }))} /></label>
        <label className="lbl">Loại yêu cầu
          <select className="inp" value={draft.requestType} onChange={e => setDraft(f => ({ ...f, requestType: e.target.value }))}>
            <option value="">Tất cả</option>
            <option value="Complaint">Khiếu nại</option>
            <option value="Return">Trả hàng</option>
            <option value="DamagedCollection">Thu hồi hàng hỏng</option>
          </select>
        </label>
        <label className="lbl">Trạng thái
          <select className="inp" value={draft.status} onChange={e => setDraft(f => ({ ...f, status: e.target.value }))}>
            <option value="">Tất cả</option>
            {STATUSES.map(s => <option key={s} value={s}>{labelOf(s)}</option>)}
          </select>
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
                  <Stat label="Tổng yêu cầu (Đang mở / Chờ thu hồi)" value={`${formatNumber(s.totalClaims)} (${formatNumber(s.openClaims)} / ${formatNumber(s.physicalCollectionPendingCount)})`} color={s.openClaims > 0 ? 'var(--c-warn, #8a3b09)' : undefined} />
                  <Stat label="SLA xử lý trung bình" value={`${formatNumber(s.averageResolutionHours)} giờ`} note={`Đã xử lý: ${formatNumber(s.resolvedClaims)}`} />
                  <Stat label="Cấn trừ công nợ" value={formatMoney(s.totalDebtOffsetAmount)} />
                  <Stat label="Hoàn tiền (Đã hoàn)" value={`${formatMoney(s.totalRefundAmount)} (${formatMoney(s.completedRefundAmount)})`} color={s.totalRefundAmount > 0 ? 'var(--c-danger, #b42318)' : undefined} />
                </div>

                {data.byWarehouse.length > 0 && (
                  <Card title="Tỷ lệ & tác động khiếu nại theo kho giao hàng">
                    <SimpleTable
                      rows={data.byWarehouse}
                      columns={[
                        { header: 'Kho', cell: w => <span><b>{w.warehouseCode}</b> · {w.warehouseName}</span> },
                        { header: 'Số khiếu nại', align: 'right', cell: w => formatNumber(w.claimCount) },
                        { header: 'Đang mở', align: 'right', cell: w => (w.openCount > 0 ? <Chip tone="warn">{w.openCount}</Chip> : '0') },
                        { header: 'SL duyệt (thùng)', align: 'right', cell: w => formatNumber(w.approvedQuantity) },
                        { header: 'Tác động tài chính', align: 'right', cell: w => <strong>{formatMoney(w.financialImpactAmount)}</strong> },
                      ]}
                    />
                  </Card>
                )}

                <Card title="Danh sách khiếu nại, trả hàng & thu hồi">
                  <div className="report-table">
                    <SimpleTable
                      paginate={false}
                      rows={data.items.items}
                      onRowClick={setSelected}
                      columns={[
                        { header: 'Tiếp nhận', cell: c => formatInstantDateTime(c.reportedAt) },
                        { header: 'Mã KN', cell: c => <b>{c.claimCode}</b> },
                        { header: 'Đơn hàng', cell: c => c.orderCode },
                        { header: 'Nhà bán lẻ', cell: c => `${c.retailerCode} · ${c.retailerName}` },
                        { header: 'Kho', cell: c => c.warehouseCode },
                        { header: 'Loại YC', cell: c => labelOf(c.requestType) },
                        { header: 'SL duyệt', align: 'right', cell: c => formatNumber(c.approvedQuantity ?? c.requestedQuantity) },
                        { header: 'Cấn trừ nợ', align: 'right', cell: c => formatMoney(c.debtOffsetAmount) },
                        { header: 'Hoàn tiền', align: 'right', cell: c => formatMoney(c.refundAmount) },
                        { header: 'Trạng thái', cell: c => <StatusChip value={labelOf(c.status)} /> },
                        ...(isGlobal ? [{
                          header: '', align: 'right' as const,
                          cell: (c: ClaimReportItem) => (
                            <div className="report-actions" onClick={e => e.stopPropagation()}>
                              <Button size="sm" onClick={() => navigate(`/complaints/${encodeURIComponent(c.claimCode)}`)}>Xử lý</Button>
                              {c.refundId && <Button size="sm" onClick={() => navigate(`/refunds/${c.refundId}`)}>Hoàn tiền</Button>}
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

                <ReportNotes scope={data.scope} notes={data.notes} />
              </>
            );
          }}
        </QueryState>
      )}

      <Modal open={!!selected} width={840} title={selected ? `Chi tiết khiếu nại · ${selected.claimCode}` : ''} onClose={() => setSelected(null)} footer={<Button onClick={() => setSelected(null)}>Đóng</Button>}>
        {selected && (
          <Fields cols={3} items={[
            { label: 'Mã khiếu nại', value: selected.claimCode },
            { label: 'Đơn hàng', value: selected.orderCode },
            { label: 'Trạng thái', value: labelOf(selected.status) },
            { label: 'Nhà bán lẻ', value: `${selected.retailerCode} · ${selected.retailerName}` },
            { label: 'Sales / Nhóm', value: `${selected.salesUserName || '—'} · ${selected.salesGroupName}` },
            { label: 'Kho giao hàng', value: `${selected.warehouseCode} · ${selected.warehouseName}` },
            { label: 'Loại yêu cầu', value: labelOf(selected.requestType) },
            { label: 'Phương thức tài chính', value: labelOf(selected.settlementMethod) },
            { label: 'Thu hồi thực tế', value: selected.returnDocCode ? `${selected.returnDocCode} (${labelOf(selected.returnDocStatus)})` : (selected.requiresCollection ? 'Chờ tạo phiếu thu hồi' : 'Không yêu cầu') },
            { label: 'SL yêu cầu / duyệt / thực nhận', value: `${selected.requestedQuantity} / ${selected.approvedQuantity ?? '—'} / ${selected.handledQuantity ?? '—'}` },
            { label: 'Cấn trừ công nợ', value: formatMoney(selected.debtOffsetAmount) },
            { label: 'Hoàn tiền mặt', value: `${formatMoney(selected.refundAmount)}${selected.refundStatus ? ` · ${labelOf(selected.refundStatus)}` : ''}` },
            { label: 'Người duyệt', value: selected.reviewedByName ?? '—' },
            { label: 'Thời gian xử lý', value: selected.resolutionHours != null ? `${selected.resolutionHours} giờ` : 'Chưa đóng' },
            { label: 'Ghi chú', value: selected.note ?? '—' },
          ]} />
        )}
      </Modal>
    </>
  );
}
