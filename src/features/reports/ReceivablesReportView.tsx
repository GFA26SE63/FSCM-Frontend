import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, getAll } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, Chip, DateInput, Fields, Modal, PageHeader, Pagination, QueryState, SimpleTable, Stat, StatusChip } from '@/shared/ui';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib';
import { downloadExcel } from '@/shared/lib/excel';
import { useAuth } from '@/shared/auth/AuthContext';
import { loadAllReportRows } from './reportExport';
import { labelOf, REPORT_TITLES } from './reportLayout';
import { ExportErrorCallout, ReportNotes, useDebounced } from './reportShared';
import type { ReceivableCustomerItem, ReceivableInvoiceItem, ReceivablesReportResult } from './types';

export function ReceivablesReportView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isGlobal = user?.role === 'Admin' || user?.role === 'Operator';

  const [view, setView] = useState<'invoices' | 'customers'>('invoices');
  const [draft, setDraft] = useState({
    dueFrom: '',
    dueTo: '',
    regionId: '',
    search: '',
    bucket: '',
    includeSettled: false,
  });
  const filters = useDebounced(draft, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<ReceivableInvoiceItem | null>(null);

  useEffect(() => { setPage(1); }, [view, filters]);

  const dateInvalid = Boolean(filters.dueFrom && filters.dueTo && filters.dueTo < filters.dueFrom);
  const regions = useQuery({
    queryKey: ['report-regions', user?.id],
    queryFn: () => getAll<{ id: string; name: string }>('/regions', { includeInactive: true }),
    enabled: !!user,
  });

  const load = (v: 'invoices' | 'customers', p: number, ps: number) => get<ReceivablesReportResult>('/reports/receivables', {
    dueFrom: filters.dueFrom || undefined,
    dueTo: filters.dueTo || undefined,
    view: v,
    regionId: filters.regionId || undefined,
    search: filters.search || undefined,
    bucket: filters.bucket || undefined,
    includeSettled: filters.includeSettled || undefined,
    page: p,
    pageSize: ps,
  });

  const query = useQuery({
    queryKey: ['business-report-receivables', user?.id, user?.role, view, filters, page, pageSize],
    queryFn: () => load(view, page, pageSize),
    enabled: !dateInvalid && !!user,
  });

  async function exportExcel() {
    if (!query.data) return;
    setExporting(true); setExportError('');
    try {
      const [invoices, customers] = await Promise.all([
        loadAllReportRows<ReceivableInvoiceItem>(async (p, size) => (await load('invoices', p, size)).invoices),
        loadAllReportRows<ReceivableCustomerItem>(async (p, size) => (await load('customers', p, size)).customers),
      ]);
      const info = [`Tính đến ngày: ${formatDate(query.data.asOfDate)}`, `Phạm vi: ${query.data.scope}`];
      await downloadExcel(`bao-cao-cong-no-${query.data.asOfDate}.xlsx`, [
        {
          name: 'Theo Nhà bán lẻ',
          title: 'Tổng hợp công nợ theo Nhà bán lẻ',
          info,
          blocks: [{
            columns: [
              { header: 'Mã NBL', width: 14 }, { header: 'Nhà bán lẻ', width: 28 }, { header: 'Khu vực', width: 16 },
              { header: 'Nhóm Sales', width: 20 }, { header: 'Nhân viên phụ trách', width: 20 },
              { header: 'Số đơn nợ', numeric: true }, { header: 'Đơn quá hạn', numeric: true },
              { header: 'Phải thu sau ĐC (đ)', numeric: true, width: 18 }, { header: 'Đã thu (đ)', numeric: true, width: 16 },
              { header: 'Còn phải thu (đ)', numeric: true, width: 18 }, { header: 'Quá hạn (đ)', numeric: true, width: 18 },
              { header: 'Quá hạn max (ngày)', numeric: true }, { header: 'Hạn mức nợ (đ)', numeric: true, width: 18 },
              { header: 'Tiền dư chưa gạch nợ (đ)', numeric: true, width: 18 },
            ],
            rows: customers.map(c => [
              c.retailerCode, c.retailerName, c.regionName, c.salesGroupName, c.salesUserName,
              c.openInvoices, c.overdueInvoices, c.adjustedTotal, c.paidTotal, c.outstandingTotal,
              c.overdueTotal, c.maxDaysOverdue, c.creditLimit, c.unappliedCreditAmount,
            ]),
          }],
        },
        {
          name: 'Chi tiết hóa đơn nợ',
          title: 'Chi tiết từng đơn hàng công nợ',
          info,
          blocks: [{
            columns: [
              { header: 'Đơn hàng', width: 16 }, { header: 'Mã NBL', width: 14 }, { header: 'Nhà bán lẻ', width: 26 },
              { header: 'Nhóm Sales', width: 18 }, { header: 'Sales phụ trách', width: 20 },
              { header: 'Ngày giao', width: 14 }, { header: 'Hạn thanh toán', width: 14 }, { header: 'Số ngày quá hạn', numeric: true },
              { header: 'Nhóm tuổi nợ', width: 18 }, { header: 'Phải thu (đ)', numeric: true, width: 16 },
              { header: 'Đã thu (đ)', numeric: true, width: 16 }, { header: 'Còn nợ (đ)', numeric: true, width: 16 },
            ],
            rows: invoices.map(i => [
              i.orderCode, i.retailerCode, i.retailerName, i.salesGroupCode, i.salesUserName,
              i.deliveredDate ? formatDate(i.deliveredDate) : '—', i.dueDate ? formatDate(i.dueDate) : '—',
              i.daysOverdue, labelOf(i.agingBucket), i.adjustedAmount, i.confirmedAmount, i.outstandingAmount,
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
        title={REPORT_TITLES.receivables}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {isGlobal && <Button onClick={() => navigate('/debts')}>Mở màn hình Công nợ</Button>}
            <Button disabled={dateInvalid || !query.data || query.isFetching} loading={exporting} onClick={() => void exportExcel()}>
              Xuất Excel
            </Button>
          </div>
        }
      />

      <div className="card report-filters">
        <label className="lbl">Từ hạn thu (tuỳ chọn)<DateInput value={draft.dueFrom} onChange={dueFrom => setDraft(f => ({ ...f, dueFrom }))} /></label>
        <label className="lbl">Đến hạn thu (tuỳ chọn)<DateInput value={draft.dueTo} onChange={dueTo => setDraft(f => ({ ...f, dueTo }))} /></label>
        <label className="lbl">Khu vực
          <select className="inp" value={draft.regionId} onChange={e => setDraft(f => ({ ...f, regionId: e.target.value }))}>
            <option value="">Tất cả khu vực</option>
            {regions.data?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="lbl">Tìm kiếm
          <input className="inp" placeholder="Mã đơn, NBL, nhóm Sales, Sales..." value={draft.search} onChange={e => setDraft(f => ({ ...f, search: e.target.value }))} />
        </label>
        <label className="lbl" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', paddingTop: 18 }}>
          <input type="checkbox" checked={draft.includeSettled} onChange={e => setDraft(f => ({ ...f, includeSettled: e.target.checked }))} />
          <span>Gồm đơn đã tất toán</span>
        </label>
        <Button onClick={() => void query.refetch()} loading={query.isFetching} disabled={dateInvalid}>Làm mới</Button>
      </div>

      <ExportErrorCallout message={exportError} />
      {dateInvalid ? <Callout tone="danger">Khoảng hạn thu không hợp lệ.</Callout> : (
        <QueryState query={query}>
          {data => {
            const s = data.summary;
            const activePaged = view === 'invoices' ? data.invoices : data.customers;
            return (
              <>
                <div className="report-summary" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                  <Stat label="Tổng công nợ còn phải thu" value={formatMoney(s.totalReceivable)} note={`${formatNumber(s.openInvoiceCount)} đơn · ${formatNumber(s.debtorRetailerCount)} điểm bán`} />
                  <Stat label="Chưa đến hạn" value={formatMoney(s.currentAmount)} />
                  <Stat label="Tổng nợ quá hạn" value={formatMoney(s.totalOverdueAmount)} color={s.totalOverdueAmount > 0 ? 'var(--c-danger, #b42318)' : undefined} />
                  <Stat label="Quá hạn > 30 ngày (Nợ xấu)" value={formatMoney(s.overdue31PlusAmount)} color={s.overdue31PlusAmount > 0 ? 'var(--c-danger, #b42318)' : undefined} />
                </div>

                <div className="report-bucket-strip" role="group" aria-label="Lọc nhanh theo nhóm tuổi nợ">
                  {data.buckets.map(b => {
                    const active = draft.bucket === b.key;
                    return (
                      <button
                        key={b.key}
                        type="button"
                        className={`report-bucket-card${active ? ' active' : ''}`}
                        onClick={() => setDraft(f => ({ ...f, bucket: active ? '' : b.key }))}
                      >
                        <div className="muted small">{b.label}</div>
                        <div className="bold" style={{ fontSize: 16, marginTop: 4 }}>{formatMoney(b.amount)}</div>
                        <div className="muted small" style={{ marginTop: 2 }}>{formatNumber(b.invoiceCount)} đơn {active ? '· Đang lọc' : ''}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="report-tabs-row" role="tablist">
                  <Button size="sm" variant={view === 'invoices' ? 'primary' : 'default'} role="tab" aria-selected={view === 'invoices'} onClick={() => setView('invoices')}>
                    Chi tiết từng đơn nợ
                  </Button>
                  <Button size="sm" variant={view === 'customers' ? 'primary' : 'default'} role="tab" aria-selected={view === 'customers'} onClick={() => setView('customers')}>
                    Tổng hợp theo Nhà bán lẻ &amp; Sales phụ trách
                  </Button>
                </div>

                <Card title={view === 'invoices' ? `Danh sách đơn công nợ · Tính đến ${formatDate(data.asOfDate)}` : 'Tổng hợp công nợ theo Nhà bán lẻ'}>
                  <div className="report-table">
                    {view === 'invoices' ? (
                      <SimpleTable
                        paginate={false}
                        rows={data.invoices.items}
                        onRowClick={setSelectedInvoice}
                        columns={[
                          { header: 'Đơn hàng', cell: i => <b>{i.orderCode}</b> },
                          { header: 'Nhà bán lẻ', cell: i => `${i.retailerCode} · ${i.retailerName}` },
                          { header: 'Sales phụ trách', cell: i => `${i.salesUserName || '—'} (${i.salesGroupCode})` },
                          { header: 'Ngày giao', cell: i => (i.deliveredDate ? formatDate(i.deliveredDate) : '—') },
                          { header: 'Hạn thanh toán', cell: i => (i.dueDate ? formatDate(i.dueDate) : '—') },
                          { header: 'Tuổi nợ', cell: i => <StatusChip value={labelOf(i.agingBucket)} /> },
                          { header: 'Quá hạn', align: 'right', cell: i => (i.daysOverdue > 0 ? <Chip tone="danger">{formatNumber(i.daysOverdue)} ngày</Chip> : '0 ngày') },
                          { header: 'Còn phải thu', align: 'right', cell: i => <strong>{formatMoney(i.outstandingAmount)}</strong> },
                          ...(isGlobal ? [{
                            header: '', align: 'right' as const,
                            cell: (i: ReceivableInvoiceItem) => (
                              <div className="report-actions" onClick={e => e.stopPropagation()}>
                                <Button size="sm" onClick={() => navigate(`/orders/${i.orderId}`)}>Đơn hàng</Button>
                              </div>
                            ),
                          }] : []),
                        ]}
                      />
                    ) : (
                      <SimpleTable
                        paginate={false}
                        rows={data.customers.items}
                        columns={[
                          { header: 'Nhà bán lẻ', cell: c => <span><b>{c.retailerCode}</b> · {c.retailerName}</span> },
                          { header: 'Sales / Nhóm', cell: c => `${c.salesUserName || '—'} · ${c.salesGroupName}` },
                          { header: 'Đơn nợ / Quá hạn', align: 'right', cell: c => `${formatNumber(c.openInvoices)} / ${formatNumber(c.overdueInvoices)}` },
                          { header: 'Quá hạn max', align: 'right', cell: c => (c.maxDaysOverdue > 0 ? <Chip tone="danger">{formatNumber(c.maxDaysOverdue)} ngày</Chip> : '—') },
                          { header: 'Tổng dư nợ', align: 'right', cell: c => <strong>{formatMoney(c.outstandingTotal)}</strong> },
                          { header: 'Nợ quá hạn', align: 'right', cell: c => <strong style={{ color: c.overdueTotal > 0 ? 'var(--c-danger, #b42318)' : undefined }}>{formatMoney(c.overdueTotal)}</strong> },
                          { header: 'Hạn mức', align: 'right', cell: c => formatMoney(c.creditLimit) },
                          { header: 'Tiền dư NBL', align: 'right', cell: c => formatMoney(c.unappliedCreditAmount) },
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

      <Modal open={!!selectedInvoice} width={780} title={selectedInvoice ? `Chi tiết công nợ · ${selectedInvoice.orderCode}` : ''} onClose={() => setSelectedInvoice(null)} footer={<Button onClick={() => setSelectedInvoice(null)}>Đóng</Button>}>
        {selectedInvoice && (
          <Fields cols={3} items={[
            { label: 'Đơn hàng', value: selectedInvoice.orderCode },
            { label: 'Nhà bán lẻ', value: `${selectedInvoice.retailerCode} · ${selectedInvoice.retailerName}` },
            { label: 'Sales phụ trách', value: `${selectedInvoice.salesUserName || '—'} · ${selectedInvoice.salesGroupName}` },
            { label: 'Ngày giao hàng', value: selectedInvoice.deliveredDate ? formatDate(selectedInvoice.deliveredDate) : '—' },
            { label: 'Hạn thanh toán', value: selectedInvoice.dueDate ? formatDate(selectedInvoice.dueDate) : '—' },
            { label: 'Tuổi nợ', value: `${labelOf(selectedInvoice.agingBucket)} (${selectedInvoice.daysOverdue} ngày)` },
            { label: 'Phải thu sau điều chỉnh', value: formatMoney(selectedInvoice.adjustedAmount) },
            { label: 'Đã xác nhận thu', value: formatMoney(selectedInvoice.confirmedAmount) },
            { label: 'Còn phải thu', value: formatMoney(selectedInvoice.outstandingAmount) },
            { label: 'Hạn mức tín dụng NBL', value: formatMoney(selectedInvoice.creditLimit) },
            { label: 'PayOS', value: selectedInvoice.payOsLinkStatus ?? 'Chưa tạo link' },
            { label: 'Ghi chú', value: selectedInvoice.note ?? '—' },
          ]} />
        )}
      </Modal>
    </>
  );
}
