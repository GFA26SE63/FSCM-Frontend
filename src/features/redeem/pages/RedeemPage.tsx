import { useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { useNavigate } from '@/shared/router/compat';
import { useQueryParams } from '@/shared/router/listState';
import { useCursorPagination } from '@/shared/pagination';
import { decodeSort, PAGINATION_PARAM_NAMES, parsePageSize } from '@/shared/pagination/urlSync';
import { Button, DataTable, PageHeader, Select, StatusChip, type Column } from '@/shared/ui';
import { formatNumber, statusLabels } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { useRedeemScope, useRedemptionsPage } from '../hooks';
import { RedeemActions } from '../components/RedeemActions';
import { normalizeRedemption } from '../api';
import {
  AGED_AFTER_MS,
  isUuid,
  REDEEM_PAGE_SIZES,
  REDEEM_SORT_MAP,
  REDEEM_SORTABLE_FIELDS,
  type RedeemPageSize,
  type RedeemSortField,
} from '../redeemGraphql';
import type { Redemption } from '../types';

const SCREEN_STATUSES = ['Requested', 'Approved', 'Delivered', 'Done', 'Rejected'] as const;
// Dashboard links use the server's words (Pending/Completed); the screen speaks Requested/Done.
const toScreenStatus = (s: string | null) => (s === 'Pending' ? 'Requested' : s === 'Completed' ? 'Done' : s);

export function RedeemPage() {
  const navigate = useNavigate();
  const { params, setParams } = useQueryParams();
  const status = toScreenStatus(params.get('status'));
  const aged = params.get('aged') === 'true';
  const regionId = params.get('regionId');
  const salesGroupId = params.get('salesGroupId');
  const search = params.get('q')?.trim() || undefined;
  const after = params.get('after') ?? undefined;
  const before = after ? undefined : (params.get('before') ?? undefined);
  const pageSize = parsePageSize(params.get('size'), REDEEM_PAGE_SIZES, 20) as RedeemPageSize;

  const rawSort = decodeSort(params.get(PAGINATION_PARAM_NAMES.SORT));
  const activeSort = rawSort?.field && REDEEM_SORT_MAP[rawSort.field as RedeemSortField]
    ? { field: rawSort.field as RedeemSortField, direction: rawSort.direction }
    : undefined;

  // Minute precision keeps the query key stable; "aged" = no update for 3+ days (as before).
  const [openedAt] = useState(() => Date.now());
  const agedBeforeIso = useMemo(() => {
    const d = new Date(openedAt - AGED_AFTER_MS);
    d.setSeconds(0, 0);
    return d.toISOString();
  }, [openedAt]);

  const scope = useRedeemScope({ search, regionId: regionId ?? undefined, salesGroupId: salesGroupId ?? undefined });
  const query = useRedemptionsPage(
    {
      size: pageSize,
      after,
      before,
      status: status || undefined,
      agedBeforeIso: aged ? agedBeforeIso : undefined,
      retailerIdIn: scope.scopeRetailerIds,
      searching: !!search,
      searchId: search && isUuid(search) ? search : undefined,
      searchRetailerIds: scope.searchRetailerIds,
      rewardIdIn: scope.searchRewardIds,
      sort: activeSort,
    },
    scope.ready,
  );
  const { pagingProps, sortProps } = useCursorPagination({
    pageInfo: query.data?.pageInfo,
    totalCount: query.data?.totalCount,
    loading: query.isLoading || query.isFetching || !scope.ready,
    error: query.isPlaceholderData ? undefined : (query.error ?? scope.error),
    defaultPageSize: 20,
    pageSizeOptions: REDEEM_PAGE_SIZES,
    urlState: true,
  });
  const rows = useMemo(() => query.data?.rows.map(normalizeRedemption), [query.data?.rows]);

  const columns: Column<Redemption>[] = [
    { key: 'code', header: 'Mã yêu cầu', width: '130px', sortable: true, render: (x) => <span className="bold">{x.code}</span> },
    { key: 'retailer', header: 'Điểm bán', text: (x) => `${x.retailerName} ${x.retailerCode}`, render: (x) => (<><div className="strong">{x.retailerName}</div><div className="muted small">{x.retailerCode}</div></>) },
    { key: 'gift', header: 'Quà', text: (x) => `${x.giftCode} ${x.giftName}`,
      render: x => <>{x.giftName}<div className="muted small">{x.giftCode} · SL: {x.quantity == null ? 'Chưa xác định' : formatNumber(x.quantity)}</div></> },
    { key: 'quantity', header: 'Số lượng', align: 'right', sortable: true, text: (x) => x.quantity == null ? '—' : formatNumber(x.quantity) },
    { key: 'points', header: 'Điểm', width: '90px', align: 'right', sortable: true, text: (x) => formatNumber(x.points) },
    { key: 'avail', header: 'Điểm khả dụng', width: '120px', align: 'right', text: (x) => formatNumber(x.available) },
    { key: 'at', header: 'Ngày yêu cầu', width: '140px', sortable: true, text: (x) => formatInstantDateTime(x.requestedAt) },
    { key: 'status', header: 'Trạng thái', width: '130px', render: (x) => <StatusChip domain="gift" value={x.status} /> },
  ];
  return (
    <>
      <PageHeader title="Yêu cầu đổi quà" subtitle="Điểm được giữ đến khi hoàn tất hoặc từ chối yêu cầu."
        actions={<><Button onClick={() => navigate('/reports?kind=redemptions')}>Báo cáo đổi quà</Button>{(status || aged || regionId || salesGroupId) && <Button onClick={() => navigate('/redeem')}>Bỏ lọc dashboard</Button>}</>} />
      <DataTable
        title="Yêu cầu đổi quà"
        rows={rows}
        loading={query.isLoading || query.isPlaceholderData || !scope.ready}
        error={query.isPlaceholderData ? undefined : (query.error ?? scope.error)}
        rowKey={(x) => x.code}
        columns={columns}
        summaryColumns={['code', 'retailer', 'gift', 'points', 'status']}
        searchPlaceholder="Mã yêu cầu, điểm bán, quà…"
        cursor={pagingProps}
        serverSort={{ ...sortProps, sortableFields: REDEEM_SORTABLE_FIELDS }}
        filterExtra={
          <label className="lbl">
            Trạng thái
            <Select
              value={status ?? ''}
              onChange={(e) => setParams({ status: e.target.value || null, after: null, before: null, page: null })}
              options={[
                { value: '', label: 'Tất cả' },
                ...SCREEN_STATUSES.map((s) => ({ value: s, label: statusLabels.gift[s] })),
              ]}
            />
          </label>
        }
        onRowClick={(x) => navigate(`/redeem/${x.code}`)}
        rowActionsWidth="150px"
        rowActions={(x) => (
          <div className="table-actions-inline">
            <Button size="sm" onClick={() => navigate(`/redeem/${x.code}`)}><Eye size={14} /> Xem</Button>
            <RedeemActions x={x} dropdown />
          </div>
        )}
      />
    </>
  );
}
