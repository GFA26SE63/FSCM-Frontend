import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, getAll } from '@/shared/api/http';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, Fields, PageHeader, QueryState, SimpleTable, Stat, Tabs } from '@/shared/ui';
import { formatNumber } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { defaultDashboardDates } from '@/features/dashboard/dashboardModel';
import { useAuth } from '@/shared/auth/AuthContext';
import { csvCell, loadAllReportRows } from './reportCsv';

type Kind = 'redemptions' | 'loyalty' | 'promotions';
interface Row {
  id: string; at: string; retailerCode: string; retailerName: string; programCode: string; programName: string;
  itemCode: string; itemName: string; status: string; quantity: number | null; points: number; balanceAfter: number | null;
  grossAmount: number; discountAmount: number; netAmount: number; orderId: string | null; orderCode: string | null;
  transactionId: string | null; createdByUserId: string | null; approvedByUserId: string | null; approvedAt: string | null;
  deliveredByUserId: string | null; deliveredAt: string | null; completedAt: string | null; cancelledAt: string | null; note: string | null;
  regionName: string; createdByName: string | null; approvedByName: string | null; deliveredByName: string | null;
  campaignDiscountAmount: number; shelfLifeDiscountAmount: number;
}
interface Result { items: Row[]; totalCount: number; page: number; pageSize: number; summary: { label: string; value: number }[]; notes: string[] }
interface Filters { fromDate: string; toDate: string; retailer: string; program: string; status: string; regionId: string }
const tabs = [{ key: 'redemptions', label: 'Báo cáo đổi quà' }, { key: 'loyalty', label: 'Biến động loyalty' }, { key: 'promotions', label: 'Sử dụng khuyến mãi' }];
const labels: Record<string, string> = {
  Pending: 'Chờ duyệt', Approved: 'Đã duyệt · chờ giao', Delivered: 'Đã giao · chờ xác nhận', Completed: 'Hoàn tất',
  Rejected: 'Từ chối', Cancelled: 'Đã hủy', Earned: 'Tích điểm', EarnedAdjusted: 'Điều chỉnh điểm tích',
  RedemptionHeld: 'Giữ điểm đổi quà', RedemptionRejected: 'Hoàn điểm do từ chối', RedemptionCompleted: 'Hoàn tất đổi quà',
  PendingEarn: 'Điểm chờ cộng', PendingEarnCancelled: 'Hủy điểm chờ', Expired: 'Điểm hết hạn',
  Allocating: 'Đang phân bổ', Quoted: 'Chờ xác nhận báo giá', AllocationFailed: 'Phân bổ thất bại',
  OutOfStock: 'Hết hàng', AllocationConflict: 'Xung đột phân bổ', Withdrawn: 'Đã rút đơn',
  QuoteRejected: 'Từ chối báo giá', QuoteExpired: 'Báo giá hết hạn', PaymentPending: 'Chờ thanh toán',
  ConvertedToPo: 'Đã xác nhận PO', Picking: 'Đang soạn hàng', Issued: 'Đã xuất kho', Delivering: 'Đang giao',
};
const statuses: Record<Kind, string[]> = {
  redemptions: ['Pending', 'Approved', 'Delivered', 'Completed', 'Rejected', 'Cancelled'],
  loyalty: ['Earned', 'EarnedAdjusted', 'PendingEarn', 'Pending', 'PendingEarnCancelled', 'RedemptionHeld', 'RedemptionRejected', 'RedemptionCompleted', 'Expired'],
  promotions: ['Completed', 'Delivered', 'Delivering', 'Picking', 'Issued', 'ConvertedToPo', 'PaymentPending', 'Quoted', 'Withdrawn', 'QuoteRejected', 'QuoteExpired', 'Allocating', 'AllocationFailed', 'OutOfStock', 'AllocationConflict'],
};
const load = (kind: Kind, filters: Filters, page: number, pageSize = 50) => get<Result>(`/reports/operations/${kind}`, { ...filters, page, pageSize });

type Column = { key: keyof Row; label: string; date?: boolean; numeric?: boolean };
function columns(kind: Kind): Column[] {
  const common: Column[] = [{ key: 'id', label: 'Mã giao dịch / yêu cầu' }, { key: 'at', label: 'Thời gian', date: true },
    { key: 'retailerCode', label: 'Mã retailer' }, { key: 'retailerName', label: 'Retailer' }, { key: 'regionName', label: 'Khu vực' },
    { key: 'programCode', label: 'Mã chương trình' }, { key: 'programName', label: 'Chương trình' }, { key: 'status', label: 'Trạng thái / nghiệp vụ' }];
  if (kind !== 'loyalty') common.push({ key: 'itemCode', label: kind === 'redemptions' ? 'Mã quà' : 'SKU' }, { key: 'itemName', label: kind === 'redemptions' ? 'Quà' : 'Sản phẩm' }, { key: 'quantity', label: 'Số lượng', numeric: true });
  if (kind === 'promotions') common.push({ key: 'grossAmount', label: 'Trước giảm (đ)', numeric: true },
    { key: 'campaignDiscountAmount', label: 'Giảm chiến dịch (đ)', numeric: true },
    { key: 'shelfLifeDiscountAmount', label: 'Giảm HSD (đ)', numeric: true },
    { key: 'discountAmount', label: 'Tiền giảm (đ)', numeric: true }, { key: 'netAmount', label: 'Sau giảm (đ)', numeric: true });
  else common.push({ key: 'points', label: kind === 'loyalty' ? 'Biến động điểm' : 'Điểm đổi', numeric: true });
  if (kind === 'loyalty') common.push({ key: 'balanceAfter', label: 'Số dư thẻ sau giao dịch', numeric: true });
  common.push({ key: 'orderCode', label: 'Đơn hàng' });
  if (kind === 'redemptions') common.push({ key: 'createdByName', label: 'Người tạo' }, { key: 'createdByUserId', label: 'Người tạo (ID)' },
    { key: 'approvedByName', label: 'Người duyệt' }, { key: 'approvedByUserId', label: 'Người duyệt (ID)' }, { key: 'approvedAt', label: 'Ngày duyệt', date: true },
    { key: 'deliveredByName', label: 'Người giao' }, { key: 'deliveredByUserId', label: 'Người giao (ID)' }, { key: 'deliveredAt', label: 'Ngày giao', date: true },
    { key: 'completedAt', label: 'Xác nhận nhận', date: true }, { key: 'cancelledAt', label: 'Từ chối / hủy', date: true },
    { key: 'transactionId', label: 'Giao dịch điểm liên quan' });
  common.push({ key: 'note', label: 'Ghi chú / batch' });
  return common;
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const initialKind = params.get('kind');
  const [kind, setKind] = useState<Kind>(initialKind === 'loyalty' || initialKind === 'promotions' ? initialKind : 'redemptions');
  const [filters, setFilters] = useState<Filters>(() => ({ ...defaultDashboardDates(), retailer: '', program: '', status: params.get('status') ?? '', regionId: '' }));
  const [draft, setDraft] = useState(filters);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const rangeDays = (Date.parse(filters.toDate) - Date.parse(filters.fromDate)) / 86400000;
  const valid = Boolean(filters.fromDate && filters.toDate && rangeDays >= 0 && rangeDays <= 366);
  const regions = useQuery({ queryKey: ['report-regions', user?.id], queryFn: () => getAll<{ id: string; name: string }>('/regions', { includeInactive: true }), enabled: !!user });
  const query = useQuery({ queryKey: ['operations-reports', user?.id, user?.role, kind, filters, page], queryFn: () => load(kind, filters, page), enabled: valid && !!user });
  const cols = columns(kind);
  const tableCols = cols.filter(c => ['at', 'retailerName', 'programCode', 'status', 'itemName', 'quantity', 'points', 'balanceAfter', 'discountAmount', 'orderCode'].includes(c.key));
  async function exportCsv() {
    setExporting(true); setExportError('');
    try {
      const rows = await loadAllReportRows((p, size) => load(kind, filters, p, size));
      const lines = [cols.map(c => csvCell(c.label)).join(','), ...rows.map(row => cols.map(c => {
        const value = row[c.key];
        return c.numeric && value != null ? String(value) : csvCell(display(row, c, kind));
      }).join(','))];
      const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a'); link.href = url; link.download = `bao-cao-${kind}-${filters.fromDate}-${filters.toDate}.csv`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setExportError(error instanceof Error ? error.message : 'Không thể xuất báo cáo.'); }
    finally { setExporting(false); }
  }
  return <>
    <PageHeader title="Báo cáo chương trình & đổi quà" subtitle="Tra cứu retailer, giao dịch điểm và giá khuyến mãi đã chốt" actions={<Button disabled={!valid || !query.data || query.isFetching} loading={exporting} onClick={() => void exportCsv()}>Xuất CSV · toàn bộ bộ lọc</Button>} />
    <Tabs items={tabs} value={kind} onChange={key => { setKind(key as Kind); setSelected(null); setPage(1); setFilters(f => ({ ...f, status: '' })); setDraft(f => ({ ...f, status: '' })); }} />
    <form className="card row-wrap" style={{ padding: 16, gap: 16 }} onSubmit={e => { e.preventDefault(); setSelected(null); setFilters({ ...draft }); setPage(1); }}>
      <label className="lbl">Từ ngày<input required className="inp" type="date" value={draft.fromDate} onChange={e => setDraft(f => ({ ...f, fromDate: e.target.value }))} /></label>
      <label className="lbl">Đến ngày<input required className="inp" type="date" min={draft.fromDate} value={draft.toDate} onChange={e => setDraft(f => ({ ...f, toDate: e.target.value }))} /></label>
      <label className="lbl">Khu vực<select className="inp" value={draft.regionId} onChange={e => setDraft(f => ({ ...f, regionId: e.target.value }))}><option value="">Tất cả khu vực</option>{regions.data?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label className="lbl">Retailer<input className="inp" placeholder="Mã hoặc tên retailer" value={draft.retailer} onChange={e => setDraft(f => ({ ...f, retailer: e.target.value }))} /></label>
      <label className="lbl">Chương trình<input className="inp" placeholder={kind === 'promotions' ? 'Mã chiến dịch hoặc HSD' : 'Mã hoặc tên chương trình'} value={draft.program} onChange={e => setDraft(f => ({ ...f, program: e.target.value }))} /></label>
      <label className="lbl">Trạng thái / loại<select className="inp" value={draft.status} onChange={e => setDraft(f => ({ ...f, status: e.target.value }))}><option value="">Tất cả</option>{statuses[kind].map(s => <option key={s} value={s}>{kind === 'loyalty' && s === 'Pending' ? 'Điểm chờ cộng (cũ)' : labels[s] ?? s}</option>)}</select></label>
      <Button type="submit">Xem báo cáo</Button><Button onClick={() => void query.refetch()} loading={query.isFetching}>Làm mới</Button>
    </form>
    {regions.isError && <Callout tone="danger">Không tải được danh sách khu vực. <Button size="sm" onClick={() => void regions.refetch()}>Thử lại</Button></Callout>}
    {exportError && <Callout tone="danger">{exportError}</Callout>}
    {!valid ? <Callout tone="danger">Chọn khoảng ngày hợp lệ, tối đa 367 ngày.</Callout> : <QueryState query={query}>{data => <>
      <div className="row-wrap" style={{ gap: 16, marginBlock: 16 }}>{data.summary.map(s => <Stat key={s.label} label={s.label} value={formatNumber(s.value)} />)}</div>
      {data.notes.map(note => <p key={note} className="muted small">{note}</p>)}
      <Card title={`${tabs.find(t => t.key === kind)?.label} · ${formatNumber(data.totalCount)} bản ghi`}>
        <SimpleTable rows={data.items} columns={[
          { header: 'Mở', cell: row => <>{kind === 'redemptions' ? <Button size="sm" onClick={() => navigate(`/redeem/${row.id}`)}>Yêu cầu</Button> : row.orderId ? <Button size="sm" onClick={() => navigate(`/orders/${row.orderId}`)}>Đơn hàng</Button> : null}
            {kind === 'loyalty' && <Button size="sm" onClick={() => navigate(`/loyalty/${encodeURIComponent(row.retailerCode)}`)}>Thẻ loyalty</Button>}</> },
          { header: 'Chi tiết', cell: row => <Button size="sm" onClick={() => setSelected(row)}>Chi tiết</Button> },
          ...tableCols.map(col => ({ header: col.label, cell: (row: Row) => display(row, col, kind) })),
        ]} />
        <div className="row-wrap" style={{ padding: 12, gap: 16 }}>
          <Button disabled={page === 1 || query.isFetching} onClick={() => setPage(p => p - 1)}>Trước</Button>
          <span>Trang {page} / {Math.max(1, Math.ceil(data.totalCount / data.pageSize))}</span>
          <Button disabled={page * data.pageSize >= data.totalCount || query.isFetching} onClick={() => setPage(p => p + 1)}>Sau</Button>
        </div>
      </Card>
      {selected && <Card title={`Chi tiết · ${selected.id}`}><Button size="sm" onClick={() => setSelected(null)}>Đóng chi tiết</Button><Fields cols={3} items={cols.map(col => ({ label: col.label, value: display(selected, col, kind) }))} /></Card>}
    </>}</QueryState>}
  </>;
}
