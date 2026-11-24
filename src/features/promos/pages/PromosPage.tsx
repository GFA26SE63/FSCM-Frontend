import { useMemo } from 'react';
import { Eye, Pause, Play } from 'lucide-react';
import { useNavigate } from '@/shared/router/compat';
import { useEnumParam, useQueryParams } from '@/shared/router/listState';
import { useCursorPagination } from '@/shared/pagination';
import { decodeSort, PAGINATION_PARAM_NAMES, PAGINATION_RESETS, parsePageSize } from '@/shared/pagination/urlSync';
import { ActionDropdown, Button, DataTable, PageHeader, Select, StatusChip, type Column } from '@/shared/ui';
import { formatInstantDate, formatPercent, statusLabels } from '@/shared/lib';
import { useActivatePromo, usePausePromo, usePromosPage } from '../hooks';
import { promoStatus } from '../status';
import {
  PROMOS_PAGE_SIZES,
  PROMOS_SORT_MAP,
  PROMOS_SORTABLE_FIELDS,
  type PromoSortField,
  type PromosPageSize,
} from '../promosGraphql';
import type { PromoSummary } from '../types';

const PROMO_STATUSES = ['', 'Running', 'Scheduled', 'Paused', 'Ended'] as const;
type PromoStatusValue = (typeof PROMO_STATUSES)[number];

export function PromosPage() {
  const navigate = useNavigate();
  const { params } = useQueryParams();
  const after = params.get('after') ?? undefined;
  const before = after ? undefined : (params.get('before') ?? undefined);
  const pageSize = parsePageSize(params.get('size'), PROMOS_PAGE_SIZES, 20) as PromosPageSize;
  const search = params.get('q') ?? undefined;
  const [statusFilter, setStatusFilter] = useEnumParam<PromoStatusValue>('status', PROMO_STATUSES, '', { resets: PAGINATION_RESETS });
  const rawSort = decodeSort(params.get(PAGINATION_PARAM_NAMES.SORT));
  const activeSort = rawSort?.field && PROMOS_SORT_MAP[rawSort.field as PromoSortField]
    ? { field: rawSort.field as PromoSortField, direction: rawSort.direction }
    : undefined;
  // Minute precision keeps the query key stable between renders while the status stays accurate.
  const nowIso = useMemo(() => { const d = new Date(); d.setSeconds(0, 0); return d.toISOString(); }, []);
  const query = usePromosPage({
    size: pageSize,
    after,
    before,
    status: statusFilter || undefined,
    nowIso: statusFilter ? nowIso : undefined,
    search,
    sort: activeSort,
  });
  const { pagingProps, sortProps } = useCursorPagination({
    pageInfo: query.data?.pageInfo,
    totalCount: query.data?.totalCount,
    loading: query.isLoading || query.isFetching,
    error: query.isPlaceholderData ? undefined : query.error,
    defaultPageSize: 20,
    pageSizeOptions: PROMOS_PAGE_SIZES,
    urlState: true,
  });
  const pause = usePausePromo();
  const activate = useActivatePromo();
  const columns: Column<PromoSummary>[] = [
    { key: 'code', header: 'Mã', width: '110px', sortable: true, render: (p) => <span className="bold">{p.code}</span> },
    { key: 'name', header: 'Tên chương trình', sortable: true },
    { key: 'type', header: 'Loại', text: (p) => p.campaignMode === 'PerSku' ? 'Loại 1 · Từng SKU' : 'Loại 2 · Nhóm SKU' },
    { key: 'min', header: 'Mua tối thiểu', width: '130px', align: 'right', text: (p) => p.campaignMode === 'PerSku' ? 'Theo từng SKU' : `${p.minimumQuantity} thùng / nhóm` },
    { key: 'pct', header: '% giảm', width: '90px', align: 'right', text: (p) => p.campaignMode === 'PerSku' ? 'Theo từng SKU' : formatPercent(p.discountPercent, 1) },
    { key: 'period', header: 'Hiệu lực', width: '180px', sortable: true, text: (p) => `${formatInstantDate(p.startAt)} – ${formatInstantDate(p.endAt)}` },
    { key: 'status', header: 'Trạng thái', width: '125px', render: (p) => <StatusChip domain="promotion" value={promoStatus(p)} /> },
  ];
  return (
    <>
      <PageHeader
        title="Khuyến mãi"
        subtitle="Loại 1 đặt ngưỡng và % giảm riêng từng SKU. Loại 2 cộng lượng của nhóm SKU trong cùng đơn. Mỗi dòng nhận khuyến mãi đủ điều kiện tốt nhất."
      />
      <DataTable
        title="Chương trình khuyến mãi"
        rows={query.data?.rows as PromoSummary[] | undefined}
        loading={query.isLoading || query.isPlaceholderData}
        error={query.isPlaceholderData ? undefined : query.error}
        rowKey={(p) => p.id}
        columns={columns}
        searchPlaceholder="Mã, tên chương trình…"
        cursor={pagingProps}
        serverSort={{ ...sortProps, sortableFields: PROMOS_SORTABLE_FIELDS }}
        filterExtra={
          <label className="lbl">
            Trạng thái
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PromoStatusValue)}
              options={[
                { value: '', label: 'Tất cả' },
                ...PROMO_STATUSES.filter(Boolean).map((s) => ({ value: s, label: statusLabels.promotion[s as Exclude<PromoStatusValue, ''>] })),
              ]}
            />
          </label>
        }
        actions={<Button variant="primary" onClick={() => navigate('/promos/new')}>+ Tạo khuyến mãi</Button>}
        onRowClick={(p) => navigate(`/promos/${p.id}`)}
        rowActionsWidth="150px"
        rowActions={(p) => (
          <div className="table-actions-inline">
            <Button size="sm" onClick={() => navigate(`/promos/${p.id}`)}><Eye size={14} /> Xem</Button>
            <ActionDropdown triggerTitle={`Thao tác khuyến mãi ${p.code}`} items={
              promoStatus(p) === 'Running' || promoStatus(p) === 'Scheduled'
                ? [{ key: 'pause', label: 'Tạm dừng', icon: <Pause size={16} />, color: 'var(--c-danger)', onClick: () => pause.mutate(p.id) }]
                : promoStatus(p) === 'Paused'
                  ? [{ key: 'activate', label: 'Kích hoạt', icon: <Play size={16} />, onClick: () => activate.mutate(p.id) }]
                  : []
            } />
          </div>
        )}
      />
    </>
  );
}
