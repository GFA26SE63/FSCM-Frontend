import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, getAll } from '@/shared/api/http';
import { errorMessage } from '@/shared/api/errors';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, Chip, DateInput, PageHeader, Pagination, QueryState, SimpleTable, Stat, StatusChip } from '@/shared/ui';
import { formatDate, formatNumber } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { downloadExcel } from '@/shared/lib/excel';
import { defaultDashboardDates } from '@/features/dashboard/dashboardModel';
import { useAuth } from '@/shared/auth/AuthContext';
import { loadAllReportRows } from './reportExport';
import { labelOf, rangeError, REPORT_TITLES } from './reportLayout';
import { ExportErrorCallout, ReportNotes, useDebounced } from './reportShared';
import type {
  FulfillmentDriverItem,
  FulfillmentInboundItem,
  FulfillmentPickingItem,
  FulfillmentReportResult,
  FulfillmentShipmentItem,
  FulfillmentTransferItem,
} from './types';

type Tab = 'shipments' | 'drivers' | 'picking' | 'inbound' | 'transfers';

export function FulfillmentReportView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSalesManager = user?.role === 'SalesManager';
  const canWarehouseTabs = !isSalesManager;
  const isGlobal = user?.role === 'Admin' || user?.role === 'Operator';

  const [tab, setTab] = useState<Tab>('shipments');
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
    enabled: !!user && canWarehouseTabs,
  });

  const load = (t: Tab, p: number, ps: number) => get<FulfillmentReportResult>('/reports/fulfillment', {
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    tab: t,
    regionId: filters.regionId || undefined,
    warehouseId: canWarehouseTabs ? (filters.warehouseId || undefined) : undefined,
    search: filters.search || undefined,
    status: filters.status || undefined,
    page: p,
    pageSize: ps,
  });

  const query = useQuery({
    queryKey: ['business-report-fulfillment', user?.id, user?.role, tab, filters, page, pageSize],
    queryFn: () => load(tab, page, pageSize),
    enabled: !invalid && !!user,
  });

  async function exportExcel() {
    if (!query.data) return;
    setExporting(true); setExportError('');
    try {
      const info = [`Kỳ: ${formatDate(filters.fromDate)} – ${formatDate(filters.toDate)}`, `Phạm vi: ${query.data.scope}`];
      const shipments = await loadAllReportRows<FulfillmentShipmentItem>(async (p, size) => (await load('shipments', p, size)).shipments);
      const drivers = await loadAllReportRows<FulfillmentDriverItem>(async (p, size) => (await load('drivers', p, size)).drivers);
      const sheets = [
        {
          name: 'Giao hàng OTIF',
          title: 'Báo cáo giao hàng & OTIF',
          info,
          blocks: [{
            columns: [
              { header: 'Mã shipment', width: 16 }, { header: 'Đơn hàng', width: 16 }, { header: 'Kho', width: 14 },
              { header: 'Nhà bán lẻ', width: 26 }, { header: 'Tài xế', width: 20 }, { header: 'Biển số', width: 14 },
              { header: 'Trạng thái', width: 16 }, { header: 'SL xuất', numeric: true }, { header: 'SL nhận', numeric: true },
              { header: 'Thiếu', numeric: true }, { header: 'Đúng hạn', width: 12 }, { header: 'Thời gian giao (giờ)', numeric: true },
            ],
            rows: shipments.map(s => [
              s.shipmentCode, s.orderCode, s.warehouseCode, `${s.retailerCode} · ${s.retailerName}`,
              s.driverName ?? '—', s.plateNumber ?? '—', labelOf(s.status), s.totalQuantity, s.receivedQuantity,
              s.shortageQuantity, s.isOnTime === true ? 'Đúng hạn' : s.isOnTime === false ? 'Trễ ETA' : '—', s.transitHours,
            ]),
          }],
        },
        {
          name: 'Tài xế & Xe',
          title: 'Hiệu suất tài xế & phương tiện',
          info,
          blocks: [{
            columns: [
              { header: 'Mã tài xế', width: 14 }, { header: 'Tài xế', width: 22 }, { header: 'Biển số', width: 14 },
              { header: 'Kho', width: 14 }, { header: 'Số chuyến', numeric: true }, { header: 'Hoàn tất', numeric: true },
              { header: 'Ngoại lệ', numeric: true }, { header: 'Đúng hạn (%)', numeric: true }, { header: 'Giao đủ (%)', numeric: true },
            ],
            rows: drivers.map(d => [
              d.driverCode, d.driverName, d.plateNumber, d.warehouseCode, d.tripCount, d.completedTrips,
              d.exceptionTrips, d.onTimeRatePercent, d.fillRatePercent,
            ]),
          }],
        },
      ];
      if (canWarehouseTabs) {
        const [picking, inbound, transfers] = await Promise.all([
          loadAllReportRows<FulfillmentPickingItem>(async (p, size) => (await load('picking', p, size)).picking),
          loadAllReportRows<FulfillmentInboundItem>(async (p, size) => (await load('inbound', p, size)).inbound),
          loadAllReportRows<FulfillmentTransferItem>(async (p, size) => (await load('transfers', p, size)).transfers),
        ]);
        sheets.push(
          {
            name: 'Soạn hàng',
            title: 'Hiệu suất soạn hàng (Picking)',
            info,
            blocks: [{
              columns: [
                { header: 'Phiếu soạn', width: 16 }, { header: 'Đơn hàng', width: 16 }, { header: 'Kho', width: 14 },
                { header: 'Trạng thái', width: 14 }, { header: 'SL yêu cầu', numeric: true }, { header: 'Đã soạn', numeric: true },
                { header: 'Thời gian (phút)', numeric: true }, { header: 'Người soạn', width: 20 }, { header: 'Người duyệt', width: 20 },
              ],
              rows: picking.map(p => [
                p.pickingCode, p.orderCode, p.warehouseCode, labelOf(p.status), p.requestedQuantity, p.pickedQuantity,
                p.pickingMinutes, p.assigneeName ?? '—', p.confirmedByName ?? '—',
              ]),
            }],
          },
          {
            name: 'Nhập kho nhà máy',
            title: 'Lịch sử nhập kho từ nhà máy',
            info,
            blocks: [{
              columns: [
                { header: 'Mã phiếu', width: 18 }, { header: 'Nguồn', width: 22 }, { header: 'Kho', width: 16 },
                { header: 'Số dòng', numeric: true }, { header: 'SL nhập (thùng)', numeric: true },
                { header: 'Trạng thái', width: 14 }, { header: 'Thời gian duyệt (giờ)', numeric: true },
              ],
              rows: inbound.map(i => [
                i.documentCode, i.sourceType, `${i.warehouseCode} · ${i.warehouseName}`, i.lineCount,
                i.receivedQuantity, labelOf(i.status), i.leadTimeHours,
              ]),
            }],
          },
          {
            name: 'Luân chuyển kho',
            title: 'Theo dõi lệnh luân chuyển nội bộ',
            info,
            blocks: [{
              columns: [
                { header: 'Mã lệnh', width: 16 }, { header: 'Từ kho', width: 16 }, { header: 'Đến kho', width: 16 },
                { header: 'Trạng thái', width: 14 }, { header: 'Tài xế', width: 20 },
                { header: 'YC (thùng)', numeric: true }, { header: 'Đã xuất', numeric: true }, { header: 'Đã nhận', numeric: true },
                { header: 'Thời gian VC (giờ)', numeric: true },
              ],
              rows: transfers.map(t => [
                t.transferCode, t.sourceWarehouseCode, t.destinationWarehouseCode, labelOf(t.status),
                t.driverName ?? '—', t.requestedQuantity, t.dispatchedQuantity, t.receivedQuantity, t.inTransitHours,
              ]),
            }],
          },
        );
      }
      await downloadExcel(`bao-cao-giao-nhan-sla-${filters.fromDate}-${filters.toDate}.xlsx`, sheets);
    } catch (err) { setExportError(errorMessage(err)); }
    finally { setExporting(false); }
  }

  return (
    <>
      <PageHeader
        title={REPORT_TITLES.fulfillment}
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
          <select className="inp" value={draft.regionId} onChange={e => setDraft(f => ({ ...f, regionId: e.target.value, warehouseId: '' }))}>
            <option value="">Tất cả khu vực</option>
            {regions.data?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        {canWarehouseTabs && (
          <label className="lbl">Kho
            <select className="inp" value={draft.warehouseId} onChange={e => setDraft(f => ({ ...f, warehouseId: e.target.value }))}>
              <option value="">Tất cả kho</option>
              {warehouses.data?.filter(w => !draft.regionId || w.regionId === draft.regionId).map(w => (
                <option key={w.id} value={w.id}>{w.code} · {w.name}</option>
              ))}
            </select>
          </label>
        )}
        <label className="lbl">Tìm kiếm<input className="inp" placeholder="Mã phiếu, đơn, tài xế, biển số..." value={draft.search} onChange={e => setDraft(f => ({ ...f, search: e.target.value }))} /></label>
        <Button onClick={() => void query.refetch()} loading={query.isFetching} disabled={!!invalid}>Làm mới</Button>
      </div>

      <ExportErrorCallout message={exportError} />
      {invalid ? <Callout tone="danger">{invalid}</Callout> : (
        <QueryState query={query}>
          {data => {
            const s = data.summary;
            const activePaged = tab === 'shipments' ? data.shipments
              : tab === 'drivers' ? data.drivers
              : tab === 'picking' ? data.picking
              : tab === 'inbound' ? data.inbound
              : data.transfers;
            return (
              <>
                <div className="report-summary" style={{ gridTemplateColumns: `repeat(${canWarehouseTabs ? 6 : 4}, minmax(0, 1fr))` }}>
                  <Stat label="Chuyến giao (Đã giao / Ngoại lệ)" value={`${formatNumber(s.shipmentCount)} (${formatNumber(s.deliveredShipmentCount)} / ${formatNumber(s.exceptionShipmentCount)})`} color={s.exceptionShipmentCount > 0 ? 'var(--c-danger, #b42318)' : undefined} />
                  <Stat label="Tỷ lệ giao đủ (Fill Rate)" value={`${formatNumber(s.fillRatePercent)}%`} note={s.shortageCartons > 0 ? `Thiếu ${formatNumber(s.shortageCartons)} thùng` : undefined} />
                  <Stat label="Giao đúng hạn ETA (OTIF)" value={`${formatNumber(s.onTimeRatePercent)}%`} color={s.onTimeRatePercent < 90 ? 'var(--c-warn, #8a3b09)' : '#15703a'} />
                  {canWarehouseTabs && <Stat label="Nhập kho nhà máy" value={`${formatNumber(s.goodsReceiptCount ?? 0)} phiếu`} note={`${formatNumber(s.goodsReceiptCartons ?? 0)} thùng`} />}
                  {canWarehouseTabs && <Stat label="Soạn hàng (Ngoại lệ)" value={`${formatNumber(s.pickingCount ?? 0)} (${formatNumber(s.pickingExceptionCount ?? 0)})`} />}
                  {canWarehouseTabs && <Stat label="Luân chuyển (Đang đi)" value={`${formatNumber(s.transferCount ?? 0)} (${formatNumber(s.transferInTransitCount ?? 0)})`} />}
                </div>

                <div className="report-tabs-row" role="tablist">
                  <Button size="sm" variant={tab === 'shipments' ? 'primary' : 'default'} onClick={() => setTab('shipments')}>Giao hàng &amp; OTIF</Button>
                  <Button size="sm" variant={tab === 'drivers' ? 'primary' : 'default'} onClick={() => setTab('drivers')}>Tài xế &amp; Phương tiện</Button>
                  {canWarehouseTabs && <Button size="sm" variant={tab === 'picking' ? 'primary' : 'default'} onClick={() => setTab('picking')}>Soạn hàng (Picking SLA)</Button>}
                  {canWarehouseTabs && <Button size="sm" variant={tab === 'inbound' ? 'primary' : 'default'} onClick={() => setTab('inbound')}>Nhập kho Nhà máy</Button>}
                  {canWarehouseTabs && <Button size="sm" variant={tab === 'transfers' ? 'primary' : 'default'} onClick={() => setTab('transfers')}>Luân chuyển Nội bộ</Button>}
                </div>

                <Card title={
                  tab === 'shipments' ? 'Chi tiết tiến độ giao hàng (Shipments)'
                    : tab === 'drivers' ? 'Năng suất tài xế & phương tiện'
                    : tab === 'picking' ? 'Hiệu suất soạn hàng (Picking)'
                    : tab === 'inbound' ? 'Lịch sử nhập kho từ nhà máy'
                    : 'Theo dõi lệnh luân chuyển giữa các kho'
                }>
                  <div className="report-table">
                    {tab === 'shipments' ? (
                      <SimpleTable
                        paginate={false}
                        rows={data.shipments.items}
                        columns={[
                          { header: 'Shipment', cell: x => <b>{x.shipmentCode}</b> },
                          { header: 'Đơn hàng', cell: x => x.orderCode },
                          { header: 'Kho', cell: x => x.warehouseCode },
                          { header: 'Nhà bán lẻ', cell: x => `${x.retailerCode} · ${x.retailerName}` },
                          { header: 'Tài xế / Xe', cell: x => (x.driverName ? `${x.driverName} (${x.plateNumber ?? ''})` : '—') },
                          { header: 'Xuất / Nhận', align: 'right', cell: x => `${formatNumber(x.totalQuantity)} / ${formatNumber(x.receivedQuantity)}` },
                          { header: 'OTIF', cell: x => (x.isOnTime === true ? <Chip tone="ok">Đúng hạn</Chip> : x.isOnTime === false ? <Chip tone="danger">Trễ ETA</Chip> : '—') },
                          { header: 'Thời gian giao', align: 'right', cell: x => (x.transitHours != null ? `${formatNumber(x.transitHours)}h` : '—') },
                          { header: 'Trạng thái', cell: x => <StatusChip value={labelOf(x.status)} /> },
                          ...(isGlobal ? [{
                            header: '', align: 'right' as const,
                            cell: (x: FulfillmentShipmentItem) => <Button size="sm" onClick={() => navigate(`/orders/${x.orderId}`)}>Đơn</Button>,
                          }] : []),
                        ]}
                      />
                    ) : tab === 'drivers' ? (
                      <SimpleTable
                        paginate={false}
                        rows={data.drivers.items}
                        columns={[
                          { header: 'Tài xế', cell: d => <span><b>{d.driverCode}</b> · {d.driverName}</span> },
                          { header: 'Biển số', cell: d => d.plateNumber },
                          { header: 'Kho', cell: d => d.warehouseCode },
                          { header: 'Chuyến (Hoàn tất / Ngoại lệ)', align: 'right', cell: d => `${d.tripCount} (${d.completedTrips} / ${d.exceptionTrips})` },
                          { header: 'Thùng giao / nhận', align: 'right', cell: d => `${formatNumber(d.totalCartons)} / ${formatNumber(d.receivedCartons)}` },
                          { header: 'Giao đủ', align: 'right', cell: d => `${d.fillRatePercent}%` },
                          { header: 'Đúng hạn', align: 'right', cell: d => <strong>{d.onTimeRatePercent}%</strong> },
                        ]}
                      />
                    ) : tab === 'picking' ? (
                      <SimpleTable
                        paginate={false}
                        rows={data.picking.items}
                        columns={[
                          { header: 'Phiếu soạn', cell: p => <b>{p.pickingCode}</b> },
                          { header: 'Đơn hàng', cell: p => p.orderCode },
                          { header: 'Kho', cell: p => p.warehouseCode },
                          { header: 'SL yêu cầu / đã soạn', align: 'right', cell: p => `${formatNumber(p.requestedQuantity)} / ${formatNumber(p.pickedQuantity)}` },
                          { header: 'Thời gian soạn', align: 'right', cell: p => (p.pickingMinutes != null ? `${formatNumber(p.pickingMinutes)} phút` : '—') },
                          { header: 'Người soạn', cell: p => p.assigneeName ?? '—' },
                          { header: 'Trạng thái', cell: p => <StatusChip value={labelOf(p.status)} /> },
                          {
                            header: '', align: 'right',
                            cell: p => <Button size="sm" onClick={() => navigate(`/runpicking?code=${encodeURIComponent(p.pickingCode)}`)}>Mở phiếu</Button>,
                          },
                        ]}
                      />
                    ) : tab === 'inbound' ? (
                      <SimpleTable
                        paginate={false}
                        rows={data.inbound.items}
                        columns={[
                          { header: 'Mã phiếu', cell: i => <b>{i.documentCode}</b> },
                          { header: 'Nguồn', cell: i => i.sourceType },
                          { header: 'Kho', cell: i => `${i.warehouseCode} · ${i.warehouseName}` },
                          { header: 'Số dòng / SL (thùng)', align: 'right', cell: i => `${i.lineCount} · ${formatNumber(i.receivedQuantity)}` },
                          { header: 'Thời gian duyệt', align: 'right', cell: i => (i.leadTimeHours != null ? `${formatNumber(i.leadTimeHours)}h` : '—') },
                          { header: 'Trạng thái', cell: i => <StatusChip value={labelOf(i.status)} /> },
                          { header: 'Ngày tạo', cell: i => formatInstantDateTime(i.createdAt) },
                        ]}
                      />
                    ) : (
                      <SimpleTable
                        paginate={false}
                        rows={data.transfers.items}
                        columns={[
                          { header: 'Mã lệnh', cell: t => <b>{t.transferCode}</b> },
                          { header: 'Luồng kho', cell: t => `${t.sourceWarehouseCode} → ${t.destinationWarehouseCode}` },
                          { header: 'Tài xế / Xe', cell: t => (t.driverName ? `${t.driverName} (${t.plateNumber ?? ''})` : '—') },
                          { header: 'YC / Xuất / Nhận', align: 'right', cell: t => `${formatNumber(t.requestedQuantity)} / ${formatNumber(t.dispatchedQuantity)} / ${formatNumber(t.receivedQuantity)}` },
                          { header: 'Thời gian VC', align: 'right', cell: t => (t.inTransitHours != null ? `${formatNumber(t.inTransitHours)}h` : '—') },
                          { header: 'Trạng thái', cell: t => <StatusChip value={labelOf(t.status)} /> },
                          {
                            header: '', align: 'right',
                            cell: () => <Button size="sm" onClick={() => navigate('/warehouse-transfers')}>Mở màn điều chuyển</Button>,
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
