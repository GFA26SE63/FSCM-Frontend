import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, getAll } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, DateInput, Fields, Modal, PageHeader, Pagination, QueryState, SimpleTable, Stat, StatusChip } from '@/shared/ui';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { downloadExcel } from '@/shared/lib/excel';
import { defaultDashboardDates } from '@/features/dashboard/dashboardModel';
import { useAuth } from '@/shared/auth/AuthContext';
import { loadAllReportRows } from './reportExport';
import { labelOf, rangeError, REPORT_TITLES, summaryColumns } from './reportLayout';
import { ExportErrorCallout, ReportNotes, useDebounced } from './reportShared';
import type { FinancialOrderItem, FinancialReceiptItem, FinancialRefundItem, FinancialReportResult } from './types';

type Tab = 'orders' | 'receipts' | 'refunds';

export function FinancialReportView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isGlobal = user?.role === 'Admin' || user?.role === 'Operator';

  const [tab, setTab] = useState<Tab>('orders');
  const [draft, setDraft] = useState(() => ({
    ...defaultDashboardDates(),
    regionId: '',
    search: '',
    status: '',
    paymentMethod: '',
  }));
  const filters = useDebounced(draft, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<FinancialOrderItem | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<FinancialRefundItem | null>(null);

  useEffect(() => { setPage(1); }, [tab, filters.fromDate, filters.toDate, filters.regionId, filters.search, filters.status, filters.paymentMethod]);

  const invalid = rangeError(filters.fromDate, filters.toDate);
  const regions = useQuery({
    queryKey: ['report-regions', user?.id],
    queryFn: () => getAll<{ id: string; name: string }>('/regions', { includeInactive: true }),
    enabled: !!user,
  });

  const load = (t: Tab, p: number, ps: number) => get<FinancialReportResult>('/reports/financial', {
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    tab: t,
    regionId: filters.regionId || undefined,
    search: filters.search || undefined,
    status: filters.status || undefined,
    paymentMethod: filters.paymentMethod || undefined,
    page: p,
    pageSize: ps,
  });

  const query = useQuery({
    queryKey: ['business-report-financial', user?.id, user?.role, tab, filters, page, pageSize],
    queryFn: () => load(tab, page, pageSize),
    enabled: !invalid && !!user,
  });

  async function exportExcel() {
    if (!query.data) return;
    setExporting(true); setExportError('');
    try {
      const s = query.data.summary;
      const [orders, receipts, refunds] = await Promise.all([
        loadAllReportRows<FinancialOrderItem>(async (p, size) => (await load('orders', p, size)).orders),
        loadAllReportRows<FinancialReceiptItem>(async (p, size) => (await load('receipts', p, size)).receipts),
        loadAllReportRows<FinancialRefundItem>(async (p, size) => (await load('refunds', p, size)).refunds),
      ]);
      const info = [
        `Kỳ báo cáo: ${formatDate(filters.fromDate)} – ${formatDate(filters.toDate)}`,
        `Phạm vi: ${query.data.scope}`,
        `Doanh thu ghi nhận: ${formatMoney(s.recognizedRevenue)} · Thực thu: ${formatMoney(s.collectedAmount)} · Đã hoàn: ${formatMoney(s.refundedAmount)}`,
      ];
      await downloadExcel(`bao-cao-tai-chinh-${filters.fromDate}-${filters.toDate}.xlsx`, [
        {
          name: 'Đơn hàng & Doanh thu',
          title: 'Báo cáo tài chính · Đơn hàng & Doanh thu',
          info,
          blocks: [{
            columns: [
              { header: 'Mã đơn', width: 16 }, { header: 'Ngày tạo', width: 18 }, { header: 'Ngày ghi nhận', width: 14 },
              { header: 'Mã NBL', width: 14 }, { header: 'Nhà bán lẻ', width: 26 }, { header: 'Nhóm Sales', width: 20 },
              { header: 'Sales', width: 20 }, { header: 'Thanh toán', width: 14 }, { header: 'Trạng thái', width: 16 },
              { header: 'Trước giảm (đ)', numeric: true, width: 16 }, { header: 'Giảm KM/HSD (đ)', numeric: true, width: 16 },
              { header: 'Điều chỉnh KN (đ)', numeric: true, width: 16 }, { header: 'Doanh thu ghi nhận (đ)', numeric: true, width: 18 },
              { header: 'Đã thu (đ)', numeric: true, width: 16 }, { header: 'Còn lại (đ)', numeric: true, width: 16 },
            ],
            rows: orders.map(o => [
              o.orderCode, formatInstantDateTime(o.createdAt), o.recognitionDate ? formatDate(o.recognitionDate) : '—',
              o.retailerCode, o.retailerName, `${o.salesGroupCode} · ${o.salesGroupName}`, o.salesUserName,
              labelOf(o.paymentMethod), labelOf(o.status),
              o.grossAmount, o.discountAmount, o.adjustmentAmount, o.netRecognizedAmount, o.paidAmount, o.remainingAmount,
            ]),
          }],
        },
        {
          name: 'Biên nhận thực thu',
          title: 'Báo cáo tài chính · Thực thu PayOS & Chuyển khoản',
          info,
          blocks: [{
            columns: [
              { header: 'Mã biên nhận', width: 18 }, { header: 'Thời điểm xác nhận', width: 18 }, { header: 'Kênh thu', width: 20 },
              { header: 'Mã NBL', width: 14 }, { header: 'Nhà bán lẻ', width: 26 },
              { header: 'Thực thu (đ)', numeric: true, width: 18 }, { header: 'Đã gạch nợ (đ)', numeric: true, width: 18 },
              { header: 'Tiền dư chưa phân bổ (đ)', numeric: true, width: 20 }, { header: 'Người xác nhận', width: 20 }, { header: 'Tham chiếu', width: 22 },
            ],
            rows: receipts.map(r => [
              r.receiptCode, r.confirmedAt ? formatInstantDateTime(r.confirmedAt) : '—', r.channel,
              r.retailerCode, r.retailerName, r.receivedAmount, r.allocatedAmount, r.unappliedCreditAmount,
              r.confirmedByName ?? 'Hệ thống / PayOS', r.reference ?? '—',
            ]),
          }],
        },
        {
          name: 'Hoàn tiền',
          title: 'Báo cáo tài chính · Hoàn tiền cho Nhà bán lẻ',
          info,
          blocks: [{
            columns: [
              { header: 'Mã hoàn tiền', width: 16 }, { header: 'Đơn hàng', width: 16 }, { header: 'Nhà bán lẻ', width: 26 },
              { header: 'Số tiền (đ)', numeric: true, width: 16 }, { header: 'Trạng thái', width: 18 },
              { header: 'Người nhận', width: 22 }, { header: 'Lý do', width: 28 }, { header: 'Ngày tạo', width: 18 }, { header: 'Ngày duyệt chi', width: 18 },
            ],
            rows: refunds.map(r => [
              r.refundCode, r.orderCode, `${r.retailerCode} · ${r.retailerName}`, r.amount, labelOf(r.status),
              r.recipient, r.reason, formatInstantDateTime(r.createdAt), r.verifiedAt ? formatInstantDateTime(r.verifiedAt) : '—',
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
        title={REPORT_TITLES.financial}
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
        <label className="lbl">Tìm kiếm
          <input className="inp" placeholder="Mã đơn, mã biên nhận, NBL, Sales..." value={draft.search} onChange={e => setDraft(f => ({ ...f, search: e.target.value }))} />
        </label>
        {tab === 'orders' && (
          <label className="lbl">Phương thức
            <select className="inp" value={draft.paymentMethod} onChange={e => setDraft(f => ({ ...f, paymentMethod: e.target.value }))}>
              <option value="">Tất cả</option>
              <option value="Prepaid">Trả trước (Prepaid)</option>
              <option value="Credit">Công nợ (Credit)</option>
            </select>
          </label>
        )}
        <Button onClick={() => void query.refetch()} loading={query.isFetching} disabled={!!invalid}>Làm mới</Button>
      </div>

      <ExportErrorCallout message={exportError} />
      {invalid ? <Callout tone="danger">{invalid}</Callout> : (
        <QueryState query={query}>
          {data => {
            const s = data.summary;
            const tiles = [
              { label: 'Đơn hoàn tất / tạo trong kỳ', value: `${formatNumber(s.completedOrderCount)} / ${formatNumber(s.createdOrderCount)}` },
              { label: 'Giá trị trước giảm (Gross)', value: formatMoney(s.grossOrderValue) },
              { label: 'Giảm giá KM & HSD', value: formatMoney(s.discountAmount) },
              { label: 'Điều chỉnh KN / Trả hàng', value: formatMoney(s.claimAdjustmentAmount) },
              { label: 'Doanh thu ghi nhận', value: formatMoney(s.recognizedRevenue), color: 'var(--c-primary, #14655b)' },
              { label: 'Tiền thực thu trong kỳ', value: formatMoney(s.collectedAmount), color: '#15703a' },
              { label: 'Hoàn tiền đã chi', value: formatMoney(s.refundedAmount), color: s.refundedAmount > 0 ? 'var(--c-danger, #b42318)' : undefined },
              ...(s.writeOffIncluded ? [{ label: 'Tổn thất hủy hàng trong kỳ', value: formatMoney(s.writeOffLossValue), color: s.writeOffLossValue > 0 ? 'var(--c-danger, #b42318)' : undefined }] : []),
              { label: 'Dòng tiền thuần (Thu − Hoàn)', value: formatMoney(s.netCashflow), color: s.netCashflow >= 0 ? '#15703a' : 'var(--c-danger, #b42318)' },
            ];
            const activePaged = tab === 'orders' ? data.orders : tab === 'receipts' ? data.receipts : data.refunds;

            return (
              <>
                <div className="report-summary" style={{ gridTemplateColumns: `repeat(${summaryColumns(tiles.length, 5)}, minmax(0, 1fr))` }}>
                  {tiles.map(t => <Stat key={t.label} label={t.label} value={t.value} color={t.color} />)}
                </div>

                <div className="report-tabs-row" role="tablist">
                  <Button size="sm" variant={tab === 'orders' ? 'primary' : 'default'} role="tab" aria-selected={tab === 'orders'} onClick={() => setTab('orders')}>
                    Đơn hàng &amp; Doanh thu ({formatNumber(s.completedOrderCount + s.createdOrderCount)} kỳ)
                  </Button>
                  <Button size="sm" variant={tab === 'receipts' ? 'primary' : 'default'} role="tab" aria-selected={tab === 'receipts'} onClick={() => setTab('receipts')}>
                    Biên nhận thực thu
                  </Button>
                  <Button size="sm" variant={tab === 'refunds' ? 'primary' : 'default'} role="tab" aria-selected={tab === 'refunds'} onClick={() => setTab('refunds')}>
                    Hoàn tiền {s.pendingRefundAmount > 0 ? `(Chờ chi ${formatMoney(s.pendingRefundAmount)})` : ''}
                  </Button>
                </div>

                <Card title={tab === 'orders' ? 'Chi tiết đơn hàng & doanh thu' : tab === 'receipts' ? 'Biên nhận thực thu đã xác nhận' : 'Danh sách hoàn tiền'}>
                  <div className="report-table">
                    {tab === 'orders' ? (
                      <SimpleTable
                        paginate={false}
                        rows={data.orders.items}
                        onRowClick={setSelectedOrder}
                        columns={[
                          { header: 'Mã đơn', cell: o => <b>{o.orderCode}</b> },
                          { header: 'Ngày tạo', cell: o => formatInstantDateTime(o.createdAt) },
                          { header: 'Ngày ghi nhận', cell: o => (o.recognitionDate ? formatDate(o.recognitionDate) : '—') },
                          { header: 'Nhà bán lẻ', cell: o => `${o.retailerCode} · ${o.retailerName}` },
                          { header: 'Nhóm / Sales', cell: o => `${o.salesGroupCode} · ${o.salesUserName || '—'}` },
                          { header: 'Thanh toán', cell: o => labelOf(o.paymentMethod) },
                          { header: 'Trạng thái', cell: o => <StatusChip value={labelOf(o.status)} /> },
                          { header: 'Doanh thu ghi nhận', align: 'right', cell: o => <strong>{formatMoney(o.netRecognizedAmount)}</strong> },
                          { header: 'Đã thu', align: 'right', cell: o => formatMoney(o.paidAmount) },
                          ...(isGlobal ? [{
                            header: '', align: 'right' as const,
                            cell: (o: FinancialOrderItem) => (
                              <div className="report-actions" onClick={e => e.stopPropagation()}>
                                <Button size="sm" onClick={() => navigate(`/orders/${o.orderId}`)}>Đơn hàng</Button>
                              </div>
                            ),
                          }] : []),
                        ]}
                      />
                    ) : tab === 'receipts' ? (
                      <SimpleTable
                        paginate={false}
                        rows={data.receipts.items}
                        columns={[
                          { header: 'Mã biên nhận', cell: r => <b>{r.receiptCode}</b> },
                          { header: 'Xác nhận lúc', cell: r => (r.confirmedAt ? formatInstantDateTime(r.confirmedAt) : '—') },
                          { header: 'Kênh thu', cell: r => r.channel },
                          { header: 'Nhà bán lẻ', cell: r => `${r.retailerCode} · ${r.retailerName}` },
                          { header: 'Thực thu', align: 'right', cell: r => <strong>{formatMoney(r.receivedAmount)}</strong> },
                          { header: 'Đã gạch nợ', align: 'right', cell: r => formatMoney(r.allocatedAmount) },
                          { header: 'Tiền dư NBL', align: 'right', cell: r => formatMoney(r.unappliedCreditAmount) },
                          { header: 'Người xác nhận', cell: r => r.confirmedByName ?? 'PayOS tự động' },
                          { header: 'Tham chiếu', cell: r => r.reference ?? '—' },
                        ]}
                      />
                    ) : (
                      <SimpleTable
                        paginate={false}
                        rows={data.refunds.items}
                        onRowClick={setSelectedRefund}
                        columns={[
                          { header: 'Mã hoàn', cell: r => <b>{r.refundCode}</b> },
                          { header: 'Đơn hàng', cell: r => r.orderCode },
                          { header: 'Nhà bán lẻ', cell: r => `${r.retailerCode} · ${r.retailerName}` },
                          { header: 'Số tiền', align: 'right', cell: r => <strong>{formatMoney(r.amount)}</strong> },
                          { header: 'Trạng thái', cell: r => <StatusChip value={labelOf(r.status)} /> },
                          { header: 'Ngày tạo', cell: r => formatInstantDateTime(r.createdAt) },
                          { header: 'Duyệt chi', cell: r => (r.verifiedAt ? formatInstantDateTime(r.verifiedAt) : '—') },
                          ...(isGlobal ? [{
                            header: '', align: 'right' as const,
                            cell: (r: FinancialRefundItem) => (
                              <div className="report-actions" onClick={e => e.stopPropagation()}>
                                <Button size="sm" onClick={() => navigate(`/refunds/${r.refundId}`)}>Mở phiếu</Button>
                              </div>
                            ),
                          }] : []),
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

      <Modal open={!!selectedOrder} width={820} title={selectedOrder ? `Chi tiết tài chính đơn ${selectedOrder.orderCode}` : ''} onClose={() => setSelectedOrder(null)} footer={<Button onClick={() => setSelectedOrder(null)}>Đóng</Button>}>
        {selectedOrder && (
          <Fields cols={3} items={[
            { label: 'Mã đơn hàng', value: selectedOrder.orderCode },
            { label: 'Nhà bán lẻ', value: `${selectedOrder.retailerCode} · ${selectedOrder.retailerName}` },
            { label: 'Khu vực', value: selectedOrder.regionName || '—' },
            { label: 'Nhóm bán hàng', value: `${selectedOrder.salesGroupCode} · ${selectedOrder.salesGroupName}` },
            { label: 'Nhân viên Sales', value: selectedOrder.salesUserName || '—' },
            { label: 'Trạng thái', value: labelOf(selectedOrder.status) },
            { label: 'Giá trị trước giảm', value: formatMoney(selectedOrder.grossAmount) },
            { label: 'Giảm giá KM & HSD', value: formatMoney(selectedOrder.discountAmount) },
            { label: 'Điều chỉnh sau giao (KN)', value: formatMoney(selectedOrder.adjustmentAmount) },
            { label: 'Doanh thu ghi nhận', value: formatMoney(selectedOrder.netRecognizedAmount) },
            { label: 'Đã thanh toán', value: formatMoney(selectedOrder.paidAmount) },
            { label: 'Còn phải thu', value: formatMoney(selectedOrder.remainingAmount) },
          ]} />
        )}
      </Modal>

      <Modal open={!!selectedRefund} width={760} title={selectedRefund ? `Chi tiết hoàn tiền ${selectedRefund.refundCode}` : ''} onClose={() => setSelectedRefund(null)} footer={<Button onClick={() => setSelectedRefund(null)}>Đóng</Button>}>
        {selectedRefund && (
          <Fields cols={2} items={[
            { label: 'Mã hoàn tiền', value: selectedRefund.refundCode },
            { label: 'Đơn hàng', value: selectedRefund.orderCode },
            { label: 'Số tiền hoàn', value: formatMoney(selectedRefund.amount) },
            { label: 'Trạng thái', value: labelOf(selectedRefund.status) },
            { label: 'Người nhận', value: selectedRefund.recipient },
            { label: 'Mã tham chiếu GD', value: selectedRefund.transactionReference ?? '—' },
            { label: 'Người nộp chứng từ', value: selectedRefund.submittedByName ?? '—' },
            { label: 'Người xác minh (Admin)', value: selectedRefund.verifiedByName ?? '—' },
            { label: 'Lý do', value: selectedRefund.reason },
          ]} />
        )}
      </Modal>
    </>
  );
}
