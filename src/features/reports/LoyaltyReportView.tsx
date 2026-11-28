import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, getAll } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, Chip, DateInput, Fields, Modal, PageHeader, Pagination, QueryState, SimpleTable, Stat, StatusChip } from '@/shared/ui';
import { formatDate, formatNumber } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { downloadExcel } from '@/shared/lib/excel';
import { defaultDashboardDates } from '@/features/dashboard/dashboardModel';
import { useAuth } from '@/shared/auth/AuthContext';
import { loadAllReportRows } from './reportExport';
import { labelOf, rangeError, REPORT_TITLES } from './reportLayout';
import { ExportErrorCallout, ReportNotes, useDebounced } from './reportShared';
import type { LoyaltyBalanceItem, LoyaltyLedgerItem, LoyaltyRedemptionItem, LoyaltyReportResult } from './types';

type Tab = 'redemptions' | 'ledger' | 'balances';

const STATUS_OPTIONS: Record<Tab, string[]> = {
  redemptions: ['Pending', 'Approved', 'Delivered', 'Completed', 'Rejected', 'Cancelled'],
  ledger: ['Earned', 'EarnedAdjusted', 'PendingEarn', 'PendingEarnCancelled', 'RedemptionHeld', 'RedemptionRejected', 'RedemptionCompleted', 'Expired'],
  balances: [],
};

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatNumber(Math.abs(n))}`;

export function LoyaltyReportView({ initialTab = 'redemptions' }: { initialTab?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isGlobal = user?.role === 'Admin' || user?.role === 'Operator';

  const [tab, setTab] = useState<Tab>(
    initialTab === 'ledger' || initialTab === 'balances' ? initialTab : 'redemptions',
  );
  const [draft, setDraft] = useState(() => ({
    ...defaultDashboardDates(),
    regionId: '',
    retailer: '',
    program: '',
    status: '',
  }));
  const filters = useDebounced(draft, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [selectedRedemption, setSelectedRedemption] = useState<LoyaltyRedemptionItem | null>(null);

  useEffect(() => { setPage(1); }, [tab, filters]);

  const invalid = rangeError(filters.fromDate, filters.toDate);
  const regions = useQuery({
    queryKey: ['report-regions', user?.id],
    queryFn: () => getAll<{ id: string; name: string }>('/regions', { includeInactive: true }),
    enabled: !!user,
  });

  const load = (t: Tab, p: number, ps: number) => get<LoyaltyReportResult>('/reports/loyalty', {
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    tab: t,
    regionId: filters.regionId || undefined,
    retailer: filters.retailer || undefined,
    program: filters.program || undefined,
    status: t === 'balances' ? undefined : (filters.status || undefined),
    page: p,
    pageSize: ps,
  });

  const query = useQuery({
    queryKey: ['business-report-loyalty', user?.id, user?.role, tab, filters, page, pageSize],
    queryFn: () => load(tab, page, pageSize),
    enabled: !invalid && !!user,
  });

  async function exportExcel() {
    if (!query.data) return;
    setExporting(true); setExportError('');
    try {
      const [redemptions, ledger, balances] = await Promise.all([
        loadAllReportRows<LoyaltyRedemptionItem>(async (p, size) => (await load('redemptions', p, size)).redemptions),
        loadAllReportRows<LoyaltyLedgerItem>(async (p, size) => (await load('ledger', p, size)).ledger),
        loadAllReportRows<LoyaltyBalanceItem>(async (p, size) => (await load('balances', p, size)).balances),
      ]);
      const info = [`Kỳ: ${formatDate(filters.fromDate)} – ${formatDate(filters.toDate)}`, `Phạm vi: ${query.data.scope}`];
      await downloadExcel(`bao-cao-loyalty-${filters.fromDate}-${filters.toDate}.xlsx`, [
        {
          name: 'Đổi quà',
          title: 'Báo cáo Loyalty · Yêu cầu đổi quà',
          info,
          blocks: [{
            columns: [
              { header: 'Thời gian', width: 18 }, { header: 'Mã NBL', width: 14 }, { header: 'Nhà bán lẻ', width: 26 },
              { header: 'Chương trình', width: 24 }, { header: 'Quà tặng', width: 26 },
              { header: 'SL', numeric: true }, { header: 'Điểm đổi', numeric: true }, { header: 'Trạng thái', width: 16 },
              { header: 'Người duyệt', width: 20 }, { header: 'Người giao', width: 20 },
            ],
            rows: redemptions.map(r => [
              formatInstantDateTime(r.createdAt), r.retailerCode, r.retailerName, r.programName,
              r.rewardName, r.quantity ?? 0, r.redeemedPoints, labelOf(r.status), r.approvedByName ?? '—', r.deliveredByName ?? '—',
            ]),
          }],
        },
        {
          name: 'Biến động điểm',
          title: 'Báo cáo Loyalty · Sổ biến động điểm',
          info,
          blocks: [{
            columns: [
              { header: 'Thời gian', width: 18 }, { header: 'Nhà bán lẻ', width: 26 }, { header: 'Chương trình', width: 24 },
              { header: 'Nghiệp vụ', width: 20 }, { header: 'Biến động điểm', numeric: true }, { header: 'Số dư sau GD', numeric: true }, { header: 'Đơn hàng', width: 16 },
            ],
            rows: ledger.map(l => [
              formatInstantDateTime(l.createdAt), `${l.retailerCode} · ${l.retailerName}`, l.programName,
              labelOf(l.transactionType), l.points, l.balanceAfter, l.orderCode ?? '—',
            ]),
          }],
        },
        {
          name: 'Số dư thẻ NBL',
          title: 'Báo cáo Loyalty · Số dư & điểm sắp hết hạn',
          info,
          blocks: [{
            columns: [
              { header: 'Mã NBL', width: 14 }, { header: 'Nhà bán lẻ', width: 26 }, { header: 'Nhóm Sales', width: 20 },
              { header: 'Điểm khả dụng', numeric: true }, { header: 'Điểm đang giữ', numeric: true },
              { header: 'Tích lũy tổng', numeric: true }, { header: 'Đã đổi tổng', numeric: true },
              { header: 'Quà chờ xử lý', numeric: true }, { header: 'Hạn điểm gần nhất', width: 18 },
            ],
            rows: balances.map(b => [
              b.retailerCode, b.retailerName, b.salesGroupName, b.currentPoints, b.heldPoints,
              b.lifetimeEarnedPoints, b.lifetimeRedeemedPoints, b.pendingRedemptionsCount,
              b.earliestProgramExpiryAt ? formatInstantDateTime(b.earliestProgramExpiryAt) : '—',
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
        title={REPORT_TITLES.loyalty}
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
        <label className="lbl">Chương trình / Quà<input className="inp" placeholder="Mã/tên chương trình, quà..." value={draft.program} onChange={e => setDraft(f => ({ ...f, program: e.target.value }))} /></label>
        {STATUS_OPTIONS[tab].length > 0 && (
          <label className="lbl">Trạng thái
            <select className="inp" value={draft.status} onChange={e => setDraft(f => ({ ...f, status: e.target.value }))}>
              <option value="">Tất cả</option>
              {STATUS_OPTIONS[tab].map(s => <option key={s} value={s}>{labelOf(s)}</option>)}
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
            const activePaged = tab === 'redemptions' ? data.redemptions : tab === 'ledger' ? data.ledger : data.balances;
            return (
              <>
                <div className="report-summary" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                  <Stat label="Đổi quà (Hoàn tất / Đang chờ)" value={`${formatNumber(s.totalRedemptions)} (${formatNumber(s.completedRedemptions)} / ${formatNumber(s.pendingRedemptions)})`} note={s.overdueRedemptions > 0 ? `Quá 3 ngày: ${formatNumber(s.overdueRedemptions)}` : undefined} color={s.overdueRedemptions > 0 ? 'var(--c-danger, #b42318)' : undefined} />
                  <Stat label="Quà đã giao / Điểm đổi" value={`${formatNumber(s.giftsDeliveredQuantity)} phần · ${formatNumber(s.redeemedPointsCompleted)} đ`} />
                  <Stat label="Biến động điểm trong kỳ" value={signed(s.periodNetPointChange)} note={`Tăng +${formatNumber(s.periodEarnedPoints)} · Giảm −${formatNumber(s.periodUsedPoints)}`} />
                  <Stat label="Điểm khả dụng toàn thẻ" value={formatNumber(s.currentAvailablePoints)} note={`${formatNumber(s.activeCardCount)} thẻ · Đang giữ ${formatNumber(s.currentHeldPoints)}`} color="var(--c-primary, #14655b)" />
                </div>

                <div className="report-tabs-row" role="tablist">
                  <Button size="sm" variant={tab === 'redemptions' ? 'primary' : 'default'} onClick={() => { setDraft(f => ({ ...f, status: '' })); setTab('redemptions'); }}>
                    Yêu cầu đổi quà ({formatNumber(s.totalRedemptions)})
                  </Button>
                  <Button size="sm" variant={tab === 'ledger' ? 'primary' : 'default'} onClick={() => { setDraft(f => ({ ...f, status: '' })); setTab('ledger'); }}>
                    Sổ biến động điểm
                  </Button>
                  <Button size="sm" variant={tab === 'balances' ? 'primary' : 'default'} onClick={() => { setDraft(f => ({ ...f, status: '' })); setTab('balances'); }}>
                    Số dư &amp; Thẻ Nhà bán lẻ ({formatNumber(s.activeCardCount)})
                  </Button>
                </div>

                <Card title={tab === 'redemptions' ? 'Danh sách yêu cầu đổi quà' : tab === 'ledger' ? 'Sổ chi tiết giao dịch điểm thưởng' : 'Số dư thẻ tích điểm theo Nhà bán lẻ'}>
                  <div className="report-table">
                    {tab === 'redemptions' ? (
                      <SimpleTable
                        paginate={false}
                        rows={data.redemptions.items}
                        onRowClick={setSelectedRedemption}
                        columns={[
                          { header: 'Thời gian', cell: r => formatInstantDateTime(r.createdAt) },
                          { header: 'Nhà bán lẻ', cell: r => `${r.retailerCode} · ${r.retailerName}` },
                          { header: 'Quà tặng', cell: r => `${r.rewardName} (${r.programCode})` },
                          { header: 'SL', align: 'right', cell: r => formatNumber(r.quantity ?? 0) },
                          { header: 'Điểm đổi', align: 'right', cell: r => formatNumber(r.redeemedPoints) },
                          { header: 'Trạng thái', cell: r => <StatusChip value={labelOf(r.status)} /> },
                          ...(isGlobal ? [{
                            header: '', align: 'right' as const,
                            cell: (r: LoyaltyRedemptionItem) => (
                              <div className="report-actions" onClick={e => e.stopPropagation()}>
                                <Button size="sm" onClick={() => navigate(`/redeem/${r.id}`)}>Yêu cầu</Button>
                              </div>
                            ),
                          }] : []),
                        ]}
                      />
                    ) : tab === 'ledger' ? (
                      <SimpleTable
                        paginate={false}
                        rows={data.ledger.items}
                        columns={[
                          { header: 'Thời gian', cell: l => formatInstantDateTime(l.createdAt) },
                          { header: 'Nhà bán lẻ', cell: l => `${l.retailerCode} · ${l.retailerName}` },
                          { header: 'Chương trình', cell: l => `${l.programCode} · ${l.programName}` },
                          { header: 'Nghiệp vụ', cell: l => <StatusChip value={labelOf(l.transactionType)} /> },
                          { header: 'Biến động', align: 'right', cell: l => <strong>{signed(l.points)}</strong> },
                          { header: 'Số dư sau GD', align: 'right', cell: l => formatNumber(l.balanceAfter) },
                          { header: 'Đơn hàng', cell: l => l.orderCode ?? '—' },
                        ]}
                      />
                    ) : (
                      <SimpleTable
                        paginate={false}
                        rows={data.balances.items}
                        columns={[
                          { header: 'Nhà bán lẻ', cell: b => <span><b>{b.retailerCode}</b> · {b.retailerName}</span> },
                          { header: 'Khu vực / Nhóm', cell: b => `${b.regionName} · ${b.salesGroupName}` },
                          { header: 'Điểm khả dụng', align: 'right', cell: b => <strong>{formatNumber(b.currentPoints)}</strong> },
                          { header: 'Đang giữ', align: 'right', cell: b => formatNumber(b.heldPoints) },
                          { header: 'Tổng đã tích', align: 'right', cell: b => formatNumber(b.lifetimeEarnedPoints) },
                          { header: 'Quà đang chờ', align: 'right', cell: b => (b.pendingRedemptionsCount > 0 ? <Chip tone="warn">{b.pendingRedemptionsCount}</Chip> : '0') },
                          { header: 'Hạn điểm gần nhất', cell: b => (b.earliestProgramExpiryAt ? formatInstantDateTime(b.earliestProgramExpiryAt) : '—') },
                          ...(isGlobal ? [{
                            header: '', align: 'right' as const,
                            cell: (b: LoyaltyBalanceItem) => (
                              <Button size="sm" onClick={() => navigate(`/loyalty/${encodeURIComponent(b.retailerCode)}`)}>Thẻ điểm</Button>
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

      <Modal open={!!selectedRedemption} width={780} title={selectedRedemption ? `Chi tiết đổi quà · ${selectedRedemption.rewardName}` : ''} onClose={() => setSelectedRedemption(null)} footer={<Button onClick={() => setSelectedRedemption(null)}>Đóng</Button>}>
        {selectedRedemption && (
          <Fields cols={3} items={[
            { label: 'Nhà bán lẻ', value: `${selectedRedemption.retailerCode} · ${selectedRedemption.retailerName}` },
            { label: 'Chương trình', value: `${selectedRedemption.programCode} · ${selectedRedemption.programName}` },
            { label: 'Quà tặng', value: `${selectedRedemption.rewardCode} · ${selectedRedemption.rewardName}` },
            { label: 'Số lượng', value: formatNumber(selectedRedemption.quantity ?? 0) },
            { label: 'Điểm đổi', value: formatNumber(selectedRedemption.redeemedPoints) },
            { label: 'Trạng thái', value: labelOf(selectedRedemption.status) },
            { label: 'Người tạo', value: selectedRedemption.createdByName ?? '—' },
            { label: 'Người duyệt', value: selectedRedemption.approvedByName ?? '—' },
            { label: 'Người giao', value: selectedRedemption.deliveredByName ?? '—' },
            { label: 'Ngày duyệt', value: selectedRedemption.approvedAt ? formatInstantDateTime(selectedRedemption.approvedAt) : '—' },
            { label: 'Ngày giao', value: selectedRedemption.deliveredAt ? formatInstantDateTime(selectedRedemption.deliveredAt) : '—' },
            { label: 'Ghi chú', value: selectedRedemption.note ?? '—' },
          ]} />
        )}
      </Modal>
    </>
  );
}
