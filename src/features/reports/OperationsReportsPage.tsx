import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, getAll } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { useLocation, useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, DateInput, Fields, Modal, PageHeader, Pagination, QueryState, SimpleTable, Stat } from '@/shared/ui';
import { formatDate, formatNumber } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { downloadExcel, type ExcelSheet } from '@/shared/lib/excel';
import { defaultDashboardDates } from '@/features/dashboard/dashboardModel';
import { useAuth } from '@/shared/auth/AuthContext';
import { loadAllReportRows } from './reportExport';
import { REPORT_TITLES, summaryColumns } from './reportLayout';
import './reports.css';

type Kind = 'redemptions' | 'loyalty' | 'promotions';
export interface PromotionProgramSummary {
  programCode: string;
  programName: string;
  orderCount: number;
  totalQuantity: number;
  grossAmount: number;
  discountAmount: number;
  campaignDiscountAmount: number;
  shelfLifeDiscountAmount: number;
  netAmount: number;
  completedDiscountAmount: number;
}
interface Row {
  id: string; at: string; retailerCode: string; retailerName: string; programCode: string; programName: string;
  itemCode: string; itemName: string; status: string; quantity: number | null; points: number; balanceAfter: number | null;
  grossAmount: number; discountAmount: number; netAmount: number; orderId: string | null; orderCode: string | null;
  transactionId: string | null; createdByUserId: string | null; approvedByUserId: string | null; approvedAt: string | null;
  deliveredByUserId: string | null; deliveredAt: string | null; completedAt: string | null; cancelledAt: string | null; note: string | null;
  regionName: string; createdByName: string | null; approvedByName: string | null; deliveredByName: string | null;
  campaignDiscountAmount: number; shelfLifeDiscountAmount: number;
}
interface Result {
  items: Row[];
  totalCount: number;
  page: number;
  pageSize: number;
  summary: { label: string; value: number }[];
  notes: string[];
  byProgram?: PromotionProgramSummary[];
  /** Loyalty only: received / used / net points over the whole filter, not just this page. */
  pointsTotal?: { received: number; used: number; net: number } | null;
}
interface Filters { fromDate: string; toDate: string; retailer: string; program: string; status: string; regionId: string }
const labels: Record<string, string> = {
  Pending: 'Chờ duyệt', Approved: 'Đã duyệt · chờ giao', Delivered: 'Đã giao · chờ xác nhận', Completed: 'Hoàn tất',
  Rejected: 'Từ chối', Cancelled: 'Đã hủy', Earned: 'Tích điểm', EarnedAdjusted: 'Điều chỉnh điểm tích',
  RedemptionHeld: 'Giữ điểm đổi quà', RedemptionRejected: 'Hoàn điểm do từ chối', RedemptionCompleted: 'Hoàn tất đổi quà',
  PendingEarn: 'Điểm chờ cộng', PendingEarnCancelled: 'Hủy điểm chờ', Expired: 'Điểm hết hạn',
  Allocating: 'Đang phân bổ', Quoted: 'Chờ xác nhận báo giá', AllocationFailed: 'Phân bổ thất bại',
  OutOfStock: 'Hết hàng', AllocationConflict: 'Xung đột phân bổ', Withdrawn: 'Đã rút đơn',
  QuoteRejected: 'Từ chối báo giá', QuoteExpired: 'Báo giá hết hạn', PaymentPending: 'Chờ thanh toán',
  ConvertedToPo: 'Đã phát hành đơn thực hiện', Picking: 'Đang soạn hàng', Issued: 'Đã xuất kho', Delivering: 'Đang giao',
};
const statuses: Record<Kind, string[]> = {
  redemptions: ['Pending', 'Approved', 'Delivered', 'Completed', 'Rejected', 'Cancelled'],
  loyalty: ['Earned', 'EarnedAdjusted', 'PendingEarn', 'Pending', 'PendingEarnCancelled', 'RedemptionHeld', 'RedemptionRejected', 'RedemptionCompleted', 'Expired'],
  promotions: ['Completed', 'Delivered', 'Delivering', 'Picking', 'Issued', 'ConvertedToPo', 'PaymentPending', 'Quoted', 'Withdrawn', 'QuoteRejected', 'QuoteExpired', 'Allocating', 'AllocationFailed', 'OutOfStock', 'AllocationConflict'],
};
const load = (kind: Kind, filters: Filters, page: number, pageSize = 50) => get<Result>(`/reports/operations/${kind}`, { ...filters, page, pageSize });

type Column = { key: keyof Row; label: string; date?: boolean; numeric?: boolean };
/** Columns shown in the list, per report; the rest (IDs, people, notes…) are in the detail popup. */
const TABLE_COLUMNS: Record<Kind, (keyof Row)[]> = {
  redemptions: ['at', 'retailerName', 'itemName', 'quantity', 'points', 'status'],
  loyalty: ['at', 'retailerName', 'programCode', 'status', 'points', 'balanceAfter'],
  promotions: ['at', 'orderCode', 'retailerName', 'programName', 'itemCode', 'quantity', 'discountAmount', 'netAmount'],
};
function columns(kind: Kind): Column[] {
  const common: Column[] = [{ key: 'id', label: 'Mã giao dịch / yêu cầu' }, { key: 'at', label: 'Thời gian', date: true },
    { key: 'retailerCode', label: 'Mã nhà bán lẻ' }, { key: 'retailerName', label: 'Nhà bán lẻ' }, { key: 'regionName', label: 'Khu vực' },
    { key: 'programCode', label: 'Mã chương trình' }, { key: 'programName', label: 'Chương trình' }, { key: 'status', label: 'Trạng thái / nghiệp vụ' }];
  if (kind !== 'loyalty') common.push({ key: 'itemCode', label: kind === 'redemptions' ? 'Mã quà' : 'SKU' }, { key: 'itemName', label: kind === 'redemptions' ? 'Quà' : 'Sản phẩm' }, { key: 'quantity', label: 'Số lượng', numeric: true });
  if (kind === 'promotions') common.push({ key: 'grossAmount', label: 'Trước giảm (đ)', numeric: true },
    { key: 'campaignDiscountAmount', label: 'Giảm chiến dịch (đ)', numeric: true },
    { key: 'shelfLifeDiscountAmount', label: 'Giảm HSD (đ)', numeric: true },
    { key: 'discountAmount', label: 'Tiền giảm (đ)', numeric: true }, { key: 'netAmount', label: 'Sau giảm (đ)', numeric: true });
  else common.push({ key: 'points', label: kind === 'loyalty' ? 'Biến động điểm' : 'Điểm đổi', numeric: true });
  if (kind === 'loyalty') common.push({ key: 'balanceAfter', label: 'Số dư thẻ sau giao dịch', numeric: true });
  // Kept for the detail popup and Excel export; which columns the list shows is TABLE_COLUMNS.
  common.push({ key: 'orderCode', label: 'Đơn hàng' });
  if (kind === 'redemptions') common.push({ key: 'createdByName', label: 'Người tạo' }, { key: 'createdByUserId', label: 'Người tạo (ID)' },
    { key: 'approvedByName', label: 'Người duyệt' }, { key: 'approvedByUserId', label: 'Người duyệt (ID)' }, { key: 'approvedAt', label: 'Ngày duyệt', date: true },
    { key: 'deliveredByName', label: 'Người giao' }, { key: 'deliveredByUserId', label: 'Người giao (ID)' }, { key: 'deliveredAt', label: 'Ngày giao', date: true },
    { key: 'completedAt', label: 'Xác nhận nhận', date: true }, { key: 'cancelledAt', label: 'Từ chối / hủy', date: true },
    { key: 'transactionId', label: 'Giao dịch điểm liên quan' });
  common.push({ key: 'note', label: 'Ghi chú / lô hàng' });
  return common;
}
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatNumber(Math.abs(n))}`;
/** Loyalty totals row: label in the first column, net change (with received / used) under "Biến động điểm". */
function loyaltyFooter(tableCols: Column[], total: NonNullable<Result['pointsTotal']>) {
  return [...tableCols.map((col, i) => {
    if (i === 0) return 'Tổng (toàn bộ bộ lọc)';
    if (col.key !== 'points') return null;
    return <span title={`Nhận +${formatNumber(total.received)} · Dùng −${formatNumber(total.used)}`}>
      {signed(total.net)}
      <span className="muted small" style={{ display: 'block', fontWeight: 500 }}>Nhận +{formatNumber(total.received)} · Dùng −{formatNumber(total.used)}</span>
    </span>;
  }), null];
}
function display(row: Row, col: Column, kind: Kind): string {
  const value = row[col.key];
  if (value == null || value === '') return '—';
  if (col.date) return formatInstantDateTime(String(value));
  if (col.numeric) return formatNumber(Number(value));
  if (col.key === 'status' && kind === 'loyalty' && value === 'Pending') return 'Điểm chờ cộng (cũ)';
  return col.key === 'status' ? labels[String(value)] ?? String(value) : String(value);
}
export function OperationsReportsPage() {
  const { search } = useLocation();
  const requested = new URLSearchParams(search).get('kind');
  const kind: Kind = requested === 'loyalty' || requested === 'promotions' ? requested : 'redemptions';
  return <OperationsReportSession key={kind} kind={kind} />;
}
function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function OperationsReportSession({ kind }: { kind: Kind }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = new URLSearchParams(useLocation().search);
  const [draft, setDraft] = useState<Filters>(() => ({ ...defaultDashboardDates(), retailer: '', program: params.get('program') ?? '', status: params.get('status') ?? '', regionId: '' }));
  const [promoViewMode, setPromoViewMode] = useState<'programs' | 'orders'>('programs');
  // Filters apply as they change (no "Xem báo cáo" button); typing is debounced.
  const filters = useDebounced(draft, 400);
  const filterKey = JSON.stringify(filters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  useEffect(() => { setPage(1); setSelected(null); }, [filterKey]);
  const rangeDays = (Date.parse(filters.toDate) - Date.parse(filters.fromDate)) / 86400000;
  const valid = Boolean(filters.fromDate && filters.toDate && rangeDays >= 0 && rangeDays <= 366);
  const regions = useQuery({ queryKey: ['report-regions', user?.id], queryFn: () => getAll<{ id: string; name: string }>('/regions', { includeInactive: true }), enabled: !!user });
  const query = useQuery({ queryKey: ['operations-reports', user?.id, user?.role, kind, filters, page, pageSize], queryFn: () => load(kind, filters, page, pageSize), enabled: valid && !!user });
  const cols = columns(kind);
  // Only the columns needed to scan the list; everything else is in the detail popup.
  const tableCols = TABLE_COLUMNS[kind].flatMap(key => cols.filter(c => c.key === key));
  const title = REPORT_TITLES[kind];
  async function exportExcel() {
    setExporting(true); setExportError('');
    try {
      const rows = await loadAllReportRows((p, size) => load(kind, filters, p, size));
      const regionName = regions.data?.find(r => r.id === filters.regionId)?.name;
      const info = [
        `Khoảng thời gian: ${formatDate(filters.fromDate)} – ${formatDate(filters.toDate)}`,
        `Khu vực: ${regionName ?? 'Tất cả khu vực'}`,
        ...(filters.retailer ? [`Nhà bán lẻ: ${filters.retailer}`] : []),
        ...(filters.program ? [`Chương trình: ${filters.program}`] : []),
        ...(filters.status ? [`Trạng thái: ${labels[filters.status] ?? filters.status}`] : []),
        `Số bản ghi: ${formatNumber(rows.length)} · Xuất lúc ${formatInstantDateTime(new Date().toISOString())}`,
      ];
      const sheets: ExcelSheet[] = [{
        name: title, title, info,
        blocks: [{
          columns: cols.map(c => ({ header: c.label, numeric: c.numeric, width: c.numeric ? 16 : c.date ? 18 : 24 })),
          rows: rows.map(row => cols.map(c => {
            const value = row[c.key];
            return c.numeric ? (value == null ? null : Number(value)) : display(row, c, kind);
          })),
          totals: kind === 'loyalty' && query.data?.pointsTotal
            ? cols.map((c, i) => i === 0 ? `Tổng · Nhận +${formatNumber(query.data!.pointsTotal!.received)} · Dùng −${formatNumber(query.data!.pointsTotal!.used)}`
              : c.key === 'points' ? query.data!.pointsTotal!.net : null)
            : undefined,
        }],
      }];
      if (kind === 'promotions' && query.data?.byProgram?.length) {
        sheets.unshift({
          name: 'Tổng hợp theo chương trình', title: `${title} · Tổng hợp theo chương trình`, info: info.slice(0, -1),
          blocks: [{
            columns: [
              { header: 'Mã CTKM', width: 16 }, { header: 'Tên chương trình khuyến mãi', width: 36 },
              { header: 'Số đơn áp dụng', numeric: true }, { header: 'Sản lượng (thùng)', numeric: true },
              { header: 'Trước giảm (đ)', numeric: true, width: 18 }, { header: 'Giảm chiến dịch (đ)', numeric: true, width: 18 },
              { header: 'Giảm HSD (đ)', numeric: true, width: 18 }, { header: 'Tổng tiền giảm KM (đ)', numeric: true, width: 18, font: 'FFB42318' },
              { header: 'Sau giảm (đ)', numeric: true, width: 18 },
            ],
            rows: query.data.byProgram.map(p => [p.programCode, p.programName, p.orderCount, p.totalQuantity, p.grossAmount,
              p.campaignDiscountAmount, p.shelfLifeDiscountAmount, p.discountAmount, p.netAmount]),
          }],
        });
      }
      await downloadExcel(`bao-cao-${kind}-${filters.fromDate}-${filters.toDate}.xlsx`, sheets);
    } catch (error) { setExportError(errorMessage(error)); }
    finally { setExporting(false); }
  }
  return <>
    <PageHeader title={title} actions={<Button disabled={!valid || !query.data || query.isFetching} loading={exporting} onClick={() => void exportExcel()}>Xuất Excel</Button>} />
    <div className="card report-filters">
      <label className="lbl">Từ ngày<DateInput required value={draft.fromDate} onChange={fromDate => setDraft(f => ({ ...f, fromDate }))} /></label>
      <label className="lbl">Đến ngày<DateInput required min={draft.fromDate} value={draft.toDate} onChange={toDate => setDraft(f => ({ ...f, toDate }))} /></label>
      <label className="lbl">Khu vực<select className="inp" value={draft.regionId} onChange={e => setDraft(f => ({ ...f, regionId: e.target.value }))}><option value="">Tất cả khu vực</option>{regions.data?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label className="lbl">Nhà bán lẻ<input className="inp" placeholder="Mã hoặc tên nhà bán lẻ" value={draft.retailer} onChange={e => setDraft(f => ({ ...f, retailer: e.target.value }))} /></label>
      <label className="lbl">Chương trình<input className="inp" placeholder={kind === 'promotions' ? 'Mã chiến dịch hoặc HSD' : 'Mã hoặc tên chương trình'} value={draft.program} onChange={e => setDraft(f => ({ ...f, program: e.target.value }))} /></label>
      <label className="lbl">Trạng thái / loại<select className="inp" value={draft.status} onChange={e => setDraft(f => ({ ...f, status: e.target.value }))}><option value="">Tất cả</option>{statuses[kind].map(s => <option key={s} value={s}>{kind === 'loyalty' && s === 'Pending' ? 'Điểm chờ cộng (cũ)' : labels[s] ?? s}</option>)}</select></label>
      <Button onClick={() => void query.refetch()} loading={query.isFetching} disabled={!valid}>Làm mới</Button>
    </div>
    {regions.isError && <Callout tone="danger">Không tải được danh sách khu vực.\n{errorMessage(regions.error)} <Button size="sm" onClick={() => void regions.refetch()}>Thử lại</Button></Callout>}
    {exportError && <Callout tone="danger">{exportError}</Callout>}
    {!valid ? <Callout tone="danger">Chọn khoảng ngày hợp lệ, tối đa 367 ngày.</Callout> : <QueryState query={query}>{data => <>
      <div className="report-summary" style={{ gridTemplateColumns: `repeat(${summaryColumns(data.summary.length)}, minmax(0, 1fr))` }}>
        {data.summary.map(s => <Stat key={s.label} label={s.label} value={formatNumber(s.value)} />)}
      </div>
      {kind === 'promotions' && (
        <div className="row-wrap" style={{ gap: 8, marginBottom: 12 }}>
          <Button
            variant={promoViewMode === 'programs' ? 'primary' : 'default'}
            size="sm"
            onClick={() => setPromoViewMode('programs')}
          >
            Tổng hợp theo khuyến mãi
          </Button>
          <Button
            variant={promoViewMode === 'orders' ? 'primary' : 'default'}
            size="sm"
            onClick={() => setPromoViewMode('orders')}
          >
            Chi tiết các đơn hàng áp dụng
          </Button>
        </div>
      )}
      {draft.program && kind === 'promotions' && (
        <div style={{ padding: '8px 14px', background: 'var(--bg-subtle, #f1f5f9)', borderRadius: 6, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Đang lọc theo chương trình: <strong>{draft.program}</strong></span>
          <Button size="sm" onClick={() => setDraft(f => ({ ...f, program: '' }))}>Xóa lọc chương trình</Button>
        </div>
      )}
      {kind === 'promotions' && promoViewMode === 'programs' ? (
        <Card title="Tổng hợp giá trị sử dụng theo chương trình khuyến mãi">
          {(!data.byProgram || data.byProgram.length === 0) ? (
            <div style={{ padding: 16 }} className="muted">
              Không có chương trình khuyến mãi nào được áp dụng trong khoảng thời gian này.
            </div>
          ) : (
            <div className="report-table">
              <SimpleTable
                rows={data.byProgram}
                columns={[
                  { header: 'Mã CTKM', cell: p => <span className="bold">{p.programCode}</span> },
                  { header: 'Tên chương trình khuyến mãi', cell: p => p.programName },
                  { header: 'Số đơn áp dụng', align: 'right', cell: p => formatNumber(p.orderCount) },
                  { header: 'Sản lượng (thùng)', align: 'right', cell: p => formatNumber(p.totalQuantity) },
                  { header: 'Trước giảm (đ)', align: 'right', cell: p => formatNumber(p.grossAmount) },
                  {
                    header: 'Tổng tiền giảm KM (đ)',
                    align: 'right',
                    cell: p => (
                      <strong style={{ color: 'var(--color-danger, #e53e3e)' }}>
                        {formatNumber(p.discountAmount)}
                      </strong>
                    ),
                  },
                  { header: 'Sau giảm (đ)', align: 'right', cell: p => formatNumber(p.netAmount) },
                  {
                    header: 'Thao tác',
                    align: 'right',
                    cell: p => (
                      <Button
                        size="sm"
                        onClick={() => {
                          setDraft(f => ({ ...f, program: p.programCode }));
                          setPromoViewMode('orders');
                        }}
                      >
                        Xem đơn hàng ({formatNumber(p.orderCount)})
                      </Button>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </Card>
      ) : (
        <Card title={title}>
          <div className="report-table"><SimpleTable paginate={false} rows={data.items} onRowClick={setSelected} footer={kind === 'loyalty' && data.pointsTotal ? loyaltyFooter(tableCols, data.pointsTotal) : undefined} columns={[
            ...tableCols.map(col => ({ header: col.label, align: col.numeric ? 'right' as const : undefined, cell: (row: Row) => display(row, col, kind) })),
            { header: '', align: 'right', cell: row => <div className="report-actions" onClick={e => e.stopPropagation()}>
              {kind === 'redemptions' && <Button size="sm" onClick={() => navigate(`/redeem/${row.id}`)}>Yêu cầu</Button>}
              {kind === 'promotions' && row.orderId && <Button size="sm" onClick={() => navigate(`/orders/${row.orderId}`)}>Đơn hàng</Button>}
              {kind === 'loyalty' && <Button size="sm" onClick={() => navigate(`/loyalty/${encodeURIComponent(row.retailerCode)}`)}>Thẻ tích điểm</Button>}
            </div> },
          ]} /></div>
          <Pagination currentPage={data.page} totalCount={data.totalCount} pageSize={data.pageSize} itemCount={data.items.length}
            totalPages={Math.max(1, Math.ceil(data.totalCount / data.pageSize))} loading={query.isFetching}
            hasPrev={data.page > 1} hasNext={data.page * data.pageSize < data.totalCount}
            onPage={setPage} onPrev={() => setPage(data.page - 1)} onNext={() => setPage(data.page + 1)}
            onPageSizeChange={value => { setPageSize(value); setPage(1); }} />
        </Card>
      )}
    </>}</QueryState>}
    <Modal open={!!selected} width={900} title={selected ? `Chi tiết · ${selected.id}` : ''} subtitle={title}
      onClose={() => setSelected(null)} footer={<Button onClick={() => setSelected(null)}>Đóng</Button>}>
      {selected && <Fields cols={3} items={cols.map(col => ({ label: col.label, value: display(selected, col, kind) }))} />}
    </Modal>
  </>;
}
