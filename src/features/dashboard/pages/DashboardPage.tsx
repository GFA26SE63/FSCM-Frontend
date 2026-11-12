import { useMemo, type CSSProperties } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import type { PortalRole } from '@/shared/auth/roles';
import { useNavigate } from '@/shared/router/compat';
import { isIsoDate, useQueryParams } from '@/shared/router/listState';
import { Button, Callout, Card, Chip, PageHeader, QueryState, SimpleTable, Stat, StatusChip, Tabs } from '@/shared/ui';
import { formatMoney, formatNumber } from '@/shared/lib';
import { formatDate, formatInstantDateTime } from '@/shared/lib/dates';
import { useDashboard } from '../hooks';
import { RevenueByDayChart } from '../components/RevenueChart';
import { DASHBOARD_TITLES, dashboardTabs, defaultDashboardDates, visibleCards } from '../dashboardModel';
import type { DashboardFilters, DashboardResponse } from '../types';
import './dashboard.css';

export function DashboardPage() {
  const { user } = useAuth();
  return user ? <DashboardSession key={user.id} role={user.role} /> : null;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ô ngày bị xóa trống: giữ trạng thái "chưa chọn" trên URL thay vì tự điền lại kỳ mặc định. */
const EMPTY_DATE = 'none';

/** Bộ lọc báo cáo lưu trên URL; thiếu ngày → kỳ mặc định (đầu tháng → hôm nay). */
function useDashboardFilters() {
  const { params, setParams } = useQueryParams();
  const search = params.toString();
  const filters = useMemo<DashboardFilters>(() => {
    const p = new URLSearchParams(search);
    const defaults = defaultDashboardDates();
    const date = (key: 'fromDate' | 'toDate') => {
      const raw = p.get(key);
      if (raw === null) return defaults[key];
      return isIsoDate(raw) ? raw : '';
    };
    const id = (key: string) => {
      const raw = p.get(key) ?? '';
      return UUID.test(raw) ? raw : '';
    };
    return { fromDate: date('fromDate'), toDate: date('toDate'), regionId: id('regionId'), warehouseId: id('warehouseId'), salesGroupId: id('salesGroupId') };
  }, [search]);
  const setFilters = (patch: Partial<DashboardFilters>) => {
    const updates: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(patch)) {
      updates[key] = key === 'fromDate' || key === 'toDate' ? (value ? value : EMPTY_DATE) : value || null;
    }
    setParams(updates);
  };
  return { filters, setFilters, tab: params.get('tab') ?? 'overview', setTab: (tab: string) => setParams({ tab: tab === 'overview' ? null : tab }) };
}

function DashboardSession({ role }: { role: PortalRole }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<DashboardFilters>(() => defaultDashboardDates());
  const [tab, setTab] = useState('overview');
  const query = useDashboard(filters);
  const options = query.data?.scope;
  const dateError = !filters.fromDate || !filters.toDate || filters.toDate < filters.fromDate || filters.toDate > defaultDashboardDates().toDate;
  const query = useDashboard(filters, !dateError);
  const options = query.data?.scope;
  return <div className="dashboard-page">
    <PageHeader title={DASHBOARD_TITLES[role]} subtitle="Số liệu từ hệ thống · cập nhật theo quyền của tài khoản"
      actions={<Button loading={query.isFetching} onClick={() => void query.refetch()}>Làm mới dữ liệu</Button>} />
    {(role === 'Admin' || role === 'Operator') && <div className="row-wrap" style={{ gap: 8 }}>
      <Button onClick={() => navigate('/reports?kind=redemptions')}>Báo cáo đổi quà</Button>
      <Button onClick={() => navigate('/reports?kind=loyalty')}>Báo cáo loyalty</Button>
      <Button onClick={() => navigate('/reports?kind=promotions')}>Báo cáo khuyến mãi</Button>
    </div>}
    <section className="card dashboard-filters" style={{ padding: 16 }} aria-label="Bộ lọc báo cáo">
      <label className="lbl">Từ ngày<input className="inp" type="date" value={filters.fromDate} max={filters.toDate}
        onChange={e => setFilters({ fromDate: e.target.value })} /></label>
      <label className="lbl">Đến ngày<input className="inp" type="date" value={filters.toDate} max={defaultDashboardDates().toDate}
        onChange={e => setFilters({ toDate: e.target.value })} /></label>
      <label className="lbl">Khu vực<select className="inp" value={filters.regionId ?? ''}
        onChange={e => setFilters({ regionId: e.target.value, warehouseId: '', salesGroupId: '' })}>
        <option value="">Tất cả trong phạm vi</option>{options?.regions.map(r => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}
      </select></label>
      {role !== 'SalesManager' && <label className="lbl">Kho<select className="inp" value={filters.warehouseId ?? ''}
        onChange={e => setFilters({ warehouseId: e.target.value })}>
        <option value="">Tất cả kho được phép xem</option>{options?.warehouses.filter(w => !filters.regionId || w.regionId === filters.regionId).map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
      </select></label>}
      {role !== 'WarehouseKeeper' && <label className="lbl">Nhóm Sales<select className="inp" value={filters.salesGroupId ?? ''}
        onChange={e => setFilters({ salesGroupId: e.target.value })}>
        <option value="">Tất cả nhóm được phép xem</option>{options?.salesGroups.filter(g => !filters.regionId || g.regionId === filters.regionId).map(g => <option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}
      </select></label>}
    </section>
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
  const cards = visibleCards(data.cards, data.role, allowed);
  const keeper = data.role === 'WarehouseKeeper';
  const manager = data.role === 'SalesManager';
  const financial = !keeper && ['overview', 'finance'].includes(allowed);
  const showStock = !manager && (allowed === 'inventory' || keeper);
  const showWork = ['overview', 'operations', 'finance'].includes(allowed);
  const work = allowed === 'finance' ? data.workItems.filter(w => ['complaint', 'refund'].includes(w.kind)) : data.workItems;
  return <>
    <div className="dashboard-scope">
      <Chip tone={data.scope.isGlobal ? 'info' : 'success'}>{data.scope.description}</Chip>
      <span>Kỳ {formatDate(data.fromDate)} – {formatDate(data.toDate)}</span>
      <span>Cập nhật {formatInstantDateTime(data.asOf)}</span>
    </div>
    {!data.scope.hasAssignments && <Callout tone="warn">Chưa có phạm vi được phân công. Liên hệ Admin để được gán khu vực, kho hoặc nhóm Sales.</Callout>}
    <Tabs items={tabs} value={allowed} onChange={onTabChange} />
    <div className="dashboard-kpis">{cards.map(c => {
      const value = c.unit === 'VND' ? formatMoney(c.value) : `${formatNumber(c.value)}${c.unit === 'carton' ? ' thùng' : c.unit === 'percent' ? '%' : ''}`;
      return <div key={c.key}><Stat label={c.label}
        value={<span className="dashboard-stat-number" style={{ '--value-characters': value.length } as CSSProperties}>{value}</span>}
        note={c.note} color={c.tone === 'danger' ? 'var(--c-danger)' : c.tone === 'warn' ? '#ad6a16' : c.tone === 'success' ? '#14655b' : undefined} />
        {c.href && <Button size="sm" onClick={() => navigate(c.href!)}>Mở danh sách</Button>}</div>;
    })}</div>
    {financial && <div className="dashboard-pair">
      <Card title="Doanh thu ghi nhận và tiền thu theo ngày"><div className="dashboard-chart"><RevenueByDayChart days={data.revenueByDay} /></div></Card>
      <Card title="Đơn tạo trong kỳ · trạng thái hiện tại">
        {data.ordersByStatus.length === 0 && <p className="muted">Không có đơn trong kỳ đã chọn.</p>}
        {data.ordersByStatus.map(s => <div className="dashboard-status-row" key={s.status}>
          <StatusChip domain="order" value={s.status} /><div className="dashboard-status-bar"><div style={{ width: `${s.count / Math.max(1, ...data.ordersByStatus.map(x => x.count)) * 100}%` }} /></div><strong>{formatNumber(s.count)}</strong>
        </div>)}
      </Card>
    </div>}
    {showWork && <Card title="Việc cần xử lý · tối đa 30 mục ưu tiên">
      <SimpleTable compact rows={work} empty="Không có công việc chờ trong phạm vi này."
        columns={[
          { header: 'Mức độ', cell: w => <Chip tone={w.priority === 1 ? 'danger' : w.priority === 2 ? 'warn' : 'info'}>{w.priority === 1 ? 'Ưu tiên cao' : w.priority === 2 ? 'Cần xử lý' : 'Đang chờ'}</Chip> },
          { header: 'Chứng từ', cell: w => <><strong>{w.code}</strong><br />{w.title}</> },
          { header: 'Trạng thái / lý do', cell: w => <>{w.status}<br /><span className="muted small">{w.reason}</span></> },
          { header: 'Chờ từ', cell: w => formatInstantDateTime(w.since) },
          { header: 'Giá trị', align: 'right', cell: w => w.amount == null ? '—' : formatMoney(w.amount) },
          { header: '', cell: w => w.href ? <Button size="sm" onClick={() => navigate(w.href!)}>Mở xử lý</Button> : 'Theo dõi trong phạm vi quản lý' },
        ]} />
    </Card>}
    {showStock && <>
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
      <Card title="Batch cần chú ý · 15 batch ưu tiên theo hạn sử dụng">
        <SimpleTable rows={data.expiryRisks} empty="Không có batch cận hạn/hết hạn còn tồn." columns={[
          { header: 'Batch / kho', cell: b => <>{b.batchCode}<br />{b.warehouseCode}</> },
          { header: 'SKU', cell: b => b.sku }, { header: 'Hết hạn', cell: b => formatDate(b.expirationDate) },
          { header: 'Tồn vật lý', align: 'right', cell: b => formatNumber(b.onHand) },
          { header: 'Khả dụng', align: 'right', cell: b => formatNumber(b.available) },
          { header: 'Cảnh báo', cell: b => <Chip tone={b.status === 'Expired' ? 'danger' : 'warn'}>{b.status === 'Expired' ? 'Hết hạn' : 'Cận hạn'}</Chip> },
          { header: '', cell: b => <Button size="sm" onClick={() => navigate(`/batches/${encodeURIComponent(b.batchCode)}`)}>Xem batch</Button> },
        ]} />
      </Card>
    </>}
    {allowed === 'sales' && <>
      <Card title="Thành viên Sales · gồm người chưa có đơn hoàn tất">
        <SimpleTable rows={data.salesTeam} empty="Chưa có thành viên Sales trong phạm vi này." columns={[
          { header: 'Thành viên / nhóm', cell: s => <>{s.name}<br /><span className="muted small">{s.groupCode}</span></> },
          { header: 'Đơn hoàn tất', align: 'right', cell: s => formatNumber(s.completedOrders) },
          { header: 'Điểm bán phục vụ', align: 'right', cell: s => formatNumber(s.retailersServed) },
          { header: 'Doanh thu', align: 'right', cell: s => formatMoney(s.revenue) },
          { header: 'KPI tổng', align: 'right', cell: s => s.kpiCompletion == null ? 'Chưa cấu hình' : `${s.kpiCompletion.toFixed(1)}%` },
          { header: '', cell: s => <Button size="sm" onClick={() => navigate(`/kpi/sales/${s.id}/${s.groupId}`)}>Xem KPI</Button> },
        ]} />
        {!!data.unattributedRevenue && <p className="dashboard-note">Doanh thu đơn tự đặt / chưa quy về thành viên đang quản lý: {formatMoney(data.unattributedRevenue)}.</p>}
      </Card>
      <Card title="10 SKU bán chạy · đơn đã hoàn tất trong kỳ">
        <SimpleTable rows={data.topProducts} columns={[
          { header: 'SKU', cell: p => p.sku }, { header: 'Sản phẩm', cell: p => p.name },
          { header: 'Thùng', align: 'right', cell: p => formatNumber(p.quantity) },
          { header: 'Doanh thu sau điều chỉnh', align: 'right', cell: p => formatMoney(p.revenue) },
        ]} />
      </Card>
    </>}
    {allowed === 'customers' && manager && <Card title="Điểm bán trong phạm vi · 30 điểm ưu tiên theo công nợ và lần mua gần nhất">
      <SimpleTable rows={data.customers} columns={[
        { header: 'Điểm bán', cell: r => <>{r.code}<br /><strong>{r.name}</strong></> },
        { header: 'Trạng thái', cell: r => r.status }, { header: 'Đơn trong kỳ', align: 'right', cell: r => formatNumber(r.periodOrders) },
        { header: 'Mua gần nhất', cell: r => r.lastOrderAt ? formatInstantDateTime(r.lastOrderAt) : 'Chưa có đơn' },
        { header: 'Tần suất dự kiến', cell: r => `${r.expectedFrequencyPerMonth} lần/tháng` },
        { header: 'Còn phải thu', align: 'right', cell: r => formatMoney(r.outstanding) },
        { header: 'Quá hạn', align: 'right', cell: r => <strong style={{ color: r.overdue > 0 ? 'var(--c-danger)' : undefined }}>{formatMoney(r.overdue)}</strong> },
      ]} />
    </Card>}
    {allowed === 'health' && data.health && <Card title="Tác vụ nền · trạng thái thực tế gần nhất">
      <div className="dashboard-kpis">
        <Stat label="Theo dõi HSD chạy gần nhất" value={data.health.expiryLastRunAt ? formatInstantDateTime(data.health.expiryLastRunAt) : 'Chưa ghi nhận'} note={data.health.expiryStatus ?? 'Chưa có lượt chạy'} />
        <Stat label="Sự kiện chờ xử lý" value={formatNumber(data.health.pendingEvents)} />
        <Stat label="Sự kiện lỗi" value={formatNumber(data.health.failedEvents)} />
        <Stat label="SO đang phân bổ quá 2 phút" value={formatNumber(data.health.abandonedAllocations)} />
      </div>
    </Card>}
    <div>{data.notes.map(note => <p key={note} className="dashboard-note">{note}</p>)}</div>
  </>;
}
