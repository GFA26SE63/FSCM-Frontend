import { useState, type CSSProperties } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import type { PortalRole } from '@/shared/auth/roles';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, Chip, DateInput, PageHeader, QueryState, SimpleTable, Stat, StatusChip, Tabs } from '@/shared/ui';
import { formatMoney, formatNumber, statusLabel } from '@/shared/lib';
import { formatDate, formatInstantDateTime } from '@/shared/lib/dates';
import { useDashboard } from '../hooks';
import { RevenueByDayChart } from '../components/RevenueChart';
import { ExpiryRiskCard } from '../components/ExpiryRiskCard';
import { DASHBOARD_TITLES, dashboardSections, dashboardTabs, defaultDashboardDates, periodChange, visibleCards } from '../dashboardModel';
import type { DashboardFilters, DashboardResponse } from '../types';
import './dashboard.css';
import { workItemStatus } from '../workItemStatus';
import { dashboardCardCopy, dashboardText } from '../dashboardCopy';

export function DashboardPage() {
  const { user } = useAuth();
  return user ? <DashboardSession key={user.id} role={user.role} /> : null;
}
function DashboardSession({ role }: { role: PortalRole }) {
  const [filters, setFilters] = useState<DashboardFilters>(() => defaultDashboardDates());
  const [tab, setTab] = useState('overview');
  const query = useDashboard(filters);
  const options = query.data?.scope;
  const dateError = !filters.fromDate || !filters.toDate || filters.toDate < filters.fromDate || filters.toDate > defaultDashboardDates().toDate;
  return <div className="dashboard-page">
    <PageHeader title={DASHBOARD_TITLES[role]}
      actions={<Button loading={query.isFetching} onClick={() => void query.refetch()}>Làm mới dữ liệu</Button>} />
    <section className="card dashboard-filters" style={{ padding: 16 }} aria-label="Bộ lọc báo cáo">
      <label className="lbl">Từ ngày<DateInput value={filters.fromDate} max={filters.toDate}
        onChange={fromDate => setFilters(f => ({ ...f, fromDate }))} /></label>
      <label className="lbl">Đến ngày<DateInput value={filters.toDate} max={defaultDashboardDates().toDate}
        onChange={toDate => setFilters(f => ({ ...f, toDate }))} /></label>
      <label className="lbl">Khu vực<select className="inp" value={filters.regionId ?? ''}
        onChange={e => setFilters(f => ({ ...f, regionId: e.target.value, warehouseId: '', salesGroupId: '' }))}>
        <option value="">Tất cả trong phạm vi</option>{options?.regions.map(r => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}
      </select></label>
      {role !== 'SalesManager' && <label className="lbl">Kho<select className="inp" value={filters.warehouseId ?? ''}
        onChange={e => setFilters(f => ({ ...f, warehouseId: e.target.value }))}>
        <option value="">Tất cả kho được phép xem</option>{options?.warehouses.filter(w => !filters.regionId || w.regionId === filters.regionId).map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
      </select></label>}
      {role !== 'WarehouseKeeper' && <label className="lbl">Nhóm bán hàng<select className="inp" value={filters.salesGroupId ?? ''}
        onChange={e => setFilters(f => ({ ...f, salesGroupId: e.target.value }))}>
        <option value="">Tất cả nhóm được phép xem</option>{options?.salesGroups.filter(g => !filters.regionId || g.regionId === filters.regionId).map(g => <option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}
      </select></label>}
    </section>
    {role !== 'SalesManager' && role !== 'WarehouseKeeper' && !!filters.warehouseId && (
      <p className="muted small" style={{ margin: '4px 0 8px' }}>
        Lưu ý: Bộ lọc <strong>Kho</strong> áp dụng cho Tồn kho, Hạn dùng và Công việc kho; Doanh thu, Đơn hàng và Công nợ được tổng hợp theo Khu vực / Nhóm bán hàng.
      </p>
    )}
    {dateError ? <Callout tone="danger">Chọn khoảng ngày hợp lệ, không vượt hôm nay.</Callout> :
      <QueryState query={query}>{data => <DashboardContent data={data} tab={tab} onTabChange={setTab} />}</QueryState>}
  </div>;
}

export function DashboardContent({ data, tab, onTabChange }: {
  data: DashboardResponse; tab: string; onTabChange: (tab: string) => void;
}) {
  const navigate = useNavigate();
  const tabs = dashboardTabs(data.role);
  const allowed = tabs.some(t => t.key === tab) ? tab : 'overview';
  const cards = visibleCards(data.cards, data.role, allowed).map(dashboardCardCopy);
  const sections = dashboardSections(data.role, allowed);
  const global = data.scope.isGlobal;
  const coverFlag = {
    BelowMinimum: ['danger', 'Dưới ngưỡng tồn'], NoSales: ['warn', 'Không bán trong 30 ngày'], Overstock: ['warn', 'Dư so với hạn dùng'],
  } as const;
  return <>
    <div className="dashboard-scope">
      <Chip tone={data.scope.isGlobal ? 'info' : 'success'}>{dashboardText(data.scope.description)}</Chip>
      <span>Kỳ {formatDate(data.fromDate)} – {formatDate(data.toDate)}</span>
      <span>Cập nhật {formatInstantDateTime(data.asOf)}</span>
    </div>
    {!data.scope.hasAssignments && <Callout tone="warn">Chưa có phạm vi được phân công. Liên hệ quản trị viên để được gán khu vực, kho hoặc nhóm bán hàng.</Callout>}
    <Tabs items={tabs} value={allowed} onChange={onTabChange} />
    <div className="dashboard-kpis">{cards.map(c => {
      const value = c.unit === 'VND' ? formatMoney(c.value) : `${formatNumber(c.value)}${c.unit === 'carton' ? ' thùng' : c.unit === 'percent' ? '%' : ''}`;
      return <div key={c.key} className="card dashboard-kpi"><Stat label={c.label}
        value={<span className="dashboard-stat-number" style={{ '--value-characters': value.length } as CSSProperties}>{value}</span>}
        note={<>{c.note}{periodChange(c.value, c.previousValue) && <><br /><strong>{periodChange(c.value, c.previousValue)}</strong></>}</>} color={c.tone === 'danger' ? 'var(--c-danger)' : c.tone === 'warn' ? '#ad6a16' : c.tone === 'success' ? '#14655b' : undefined} />
        {c.href && <Button size="sm" onClick={() => navigate(c.href!)}>Mở danh sách</Button>}</div>;
    })}</div>
    {sections.revenue && <div className="dashboard-pair">
      <Card title="Doanh thu ghi nhận và tiền thu theo ngày"><div className="dashboard-chart"><RevenueByDayChart days={data.revenueByDay} /></div></Card>
      <Card title="Đơn tạo trong kỳ · trạng thái hiện tại">
        {data.ordersByStatus.length === 0 && <p className="muted">Không có đơn trong kỳ đã chọn.</p>}
        {data.ordersByStatus.map(s => <div className="dashboard-status-row" key={s.status}>
          <StatusChip domain="order" value={s.status} /><div className="dashboard-status-bar"><div style={{ width: `${s.count / Math.max(1, ...data.ordersByStatus.map(x => x.count)) * 100}%` }} /></div><strong>{formatNumber(s.count)}</strong>
        </div>)}
      </Card>
    </div>}
    {sections.receivables && !!data.debtAging?.length && <div className="dashboard-pair">
      <Card title="Tuổi nợ công nợ · số hiện tại">
        <SimpleTable compact rows={data.debtAging} columns={[
          { header: 'Nhóm', cell: b => <Chip tone={b.key === 'current' ? 'info' : b.key === 'd1_7' ? 'warn' : 'danger'}>{b.label}</Chip> },
          { header: 'Số đơn', align: 'right', cell: b => formatNumber(b.count) },
          { header: 'Còn phải thu', align: 'right', cell: b => <strong>{formatMoney(b.amount)}</strong> },
        ]} />
      </Card>
      {global && <Card title="Nhà bán lẻ nợ nhiều nhất · 10 điểm ưu tiên theo quá hạn">
        <SimpleTable compact rows={data.customers.filter(r => r.outstanding > 0).slice(0, 10)} onRowClick={r => navigate(`/retailers/${r.id}`)} empty="Không có nhà bán lẻ còn công nợ." columns={[
          { header: 'Nhà bán lẻ', cell: r => <>{r.code}<br /><strong>{r.name}</strong></> },
          { header: 'Còn phải thu', align: 'right', cell: r => formatMoney(r.outstanding) },
          { header: 'Quá hạn', align: 'right', cell: r => <strong style={{ color: r.overdue > 0 ? 'var(--c-danger)' : undefined }}>{formatMoney(r.overdue)}</strong> },
        ]} />
      </Card>}
    </div>}
    {sections.work && <WorkCard rows={data.workItems} />}
    {sections.stock && <>
      <Card title="Tồn kho hiện tại · thùng">
        <SimpleTable rows={data.inventory} empty="Chưa có tồn kho trong phạm vi đã chọn." columns={[
          { header: 'Kho', cell: w => <>{w.code}<br /><span className="muted small">{w.name}</span></> },
          { header: 'Vật lý', align: 'right', cell: w => formatNumber(w.onHand) },
          { header: 'Đang giữ', align: 'right', cell: w => formatNumber(w.reserved) },
          { header: 'Đang khóa', align: 'right', cell: w => formatNumber(w.locked) },
          { header: 'Khả dụng', align: 'right', cell: w => <strong>{formatNumber(w.available)}</strong> },
          { header: 'Cận hạn', align: 'right', cell: w => formatNumber(w.nearExpiry) },
          { header: 'Hết hạn', align: 'right', cell: w => formatNumber(w.expired) },
        ]} />
      </Card>
      <Card title="SKU cần chú ý về tồn · theo khu vực, tốc độ bán 30 ngày và hạn dùng">
        <SimpleTable rows={data.stockCover ?? []} empty="Không có SKU dưới ngưỡng, không bán hoặc tồn dư trong phạm vi đã chọn." columns={[
          { header: 'Khu vực', cell: s => s.regionCode },
          { header: 'SKU', cell: s => <>{s.sku}<br /><span className="muted small">{s.name}</span></> },
          { header: 'Khả dụng', align: 'right', cell: s => <strong>{formatNumber(s.available)}</strong> },
          { header: 'Ngưỡng', align: 'right', cell: s => formatNumber(s.minimumStock) },
          { header: 'Bán 30 ngày', align: 'right', cell: s => formatNumber(s.soldLast30Days) },
          { header: 'Đủ bán', align: 'right', cell: s => s.daysOfSupply == null ? '—' : `${formatNumber(s.daysOfSupply)} ngày` },
          { header: 'Hạn dùng', align: 'right', cell: s => `${formatNumber(s.shelfLifeDays)} ngày` },
          { header: 'Cảnh báo', cell: s => <Chip tone={coverFlag[s.flag][0]}>{coverFlag[s.flag][1]}</Chip> },
        ]} />
      </Card>
      <ExpiryRiskCard rows={data.expiryRisks} total={data.expiryRiskTotal} />
    </>}
    {sections.sales && <>
      <Card title="Nhân viên bán hàng · gồm người chưa có đơn hoàn tất">
        <SimpleTable rows={data.salesTeam} onRowClick={s => navigate(`/kpi/sales/${s.id}/${s.groupId}`)} empty="Chưa có nhân viên bán hàng trong phạm vi này." columns={[
          { header: 'Thành viên / nhóm', cell: s => <>{s.name}<br /><span className="muted small">{s.groupCode}</span></> },
          { header: 'Đơn hoàn tất', align: 'right', cell: s => formatNumber(s.completedOrders) },
          { header: 'Nhà bán lẻ phục vụ', align: 'right', cell: s => formatNumber(s.retailersServed) },
          { header: 'Doanh thu', align: 'right', cell: s => formatMoney(s.revenue) },
          { header: 'KPI tổng', align: 'right', cell: s => s.kpiCompletion == null ? 'Chưa cấu hình' : `${s.kpiCompletion.toFixed(1)}%` },
        ]} />
        {!!data.unattributedRevenue && <p className="dashboard-note">Doanh thu đơn tự đặt / chưa quy về thành viên đang quản lý: {formatMoney(data.unattributedRevenue)}.</p>}
      </Card>
      <TopProductsCard rows={data.topProducts} />
    </>}
    {sections.customers && <Card title="Nhà bán lẻ trong phạm vi · 30 điểm ưu tiên theo công nợ và lần mua gần nhất">
      <SimpleTable rows={data.customers} onRowClick={global ? r => navigate(`/retailers/${r.id}`) : undefined} columns={[
        { header: 'Nhà bán lẻ', cell: r => <>{r.code}<br /><strong>{r.name}</strong></> },
        { header: 'Trạng thái', cell: r => statusLabel('retailer', r.status) }, { header: 'Đơn trong kỳ', align: 'right', cell: r => formatNumber(r.periodOrders) },
        { header: 'Mua gần nhất', cell: r => r.lastOrderAt ? formatInstantDateTime(r.lastOrderAt) : 'Chưa có đơn' },
        { header: 'Tần suất dự kiến', cell: r => <>{r.expectedFrequencyPerMonth} lần/tháng{r.cycleOverdue && <><br /><Chip tone="warn">Quá chu kỳ mua</Chip></>}</> },
        { header: 'Còn phải thu', align: 'right', cell: r => formatMoney(r.outstanding) },
        { header: 'Quá hạn', align: 'right', cell: r => <strong style={{ color: r.overdue > 0 ? 'var(--c-danger)' : undefined }}>{formatMoney(r.overdue)}</strong> },
      ]} />
    </Card>}
    {sections.health && data.health && <Card title="Tác vụ nền · trạng thái thực tế gần nhất">
      <div className="dashboard-kpis">
        <Stat label="Theo dõi HSD chạy gần nhất" value={data.health.expiryLastRunAt ? formatInstantDateTime(data.health.expiryLastRunAt) : 'Chưa ghi nhận'} note={data.health.expiryStatus ? statusLabel('expirySweep', data.health.expiryStatus) : 'Chưa có lượt chạy'} />
        <Stat label="Sự kiện chờ xử lý" value={formatNumber(data.health.pendingEvents)} />
        <Stat label="Sự kiện lỗi" value={formatNumber(data.health.failedEvents)} />
      </div>
    </Card>}
  </>;
}

/** "Việc cần xử lý": highest priority first, using the common table pager. */
function WorkCard({ rows }: { rows: DashboardResponse['workItems'] }) {
  const navigate = useNavigate();
  return <Card title="Việc cần xử lý">
    <SimpleTable paginate compact rows={rows} empty="Không có công việc chờ trong phạm vi này."
      columns={[
        { header: 'Mức độ', cell: w => <Chip tone={w.priority === 1 ? 'danger' : w.priority === 2 ? 'warn' : 'info'}>{w.priority === 1 ? 'Ưu tiên cao' : w.priority === 2 ? 'Cần xử lý' : 'Đang chờ'}</Chip> },
        { header: 'Chứng từ', cell: w => <><strong>{w.code}</strong><br />{w.kind === 'shipment' ? dashboardText(w.title) : w.title}</> },
        { header: 'Trạng thái / lý do', cell: w => <>{workItemStatus(w.kind, w.status)}<br /><span className="muted small">{['refund', 'receipt'].includes(w.kind) ? dashboardText(w.reason) : w.reason}</span></> },
        { header: 'Chờ từ', cell: w => formatInstantDateTime(w.since) },
        { header: 'Giá trị', align: 'right', cell: w => w.amount == null ? '—' : formatMoney(w.amount) },
        { header: '', cell: w => w.href ? <Button size="sm" onClick={() => navigate(w.href!)}>Mở xử lý</Button> : 'Theo dõi trong phạm vi quản lý' },
      ]} />
  </Card>;
}

/** "Top SKU bán chạy" keeps the backend ranking while using the common pager. */
function TopProductsCard({ rows }: { rows: DashboardResponse['topProducts'] }) {
  return <Card title="Top SKU bán chạy">
    <SimpleTable paginate rows={rows} empty="Chưa có SKU bán ra trong kỳ đã chọn." columns={[
      { header: '#', align: 'right', cell: p => formatNumber(rows.indexOf(p) + 1) },
      { header: 'SKU', cell: p => p.sku }, { header: 'Sản phẩm', cell: p => p.name },
      { header: 'Thùng', align: 'right', cell: p => formatNumber(p.quantity) },
      { header: 'Doanh thu sau điều chỉnh', align: 'right', cell: p => formatMoney(p.revenue) },
    ]} />
  </Card>;
}
