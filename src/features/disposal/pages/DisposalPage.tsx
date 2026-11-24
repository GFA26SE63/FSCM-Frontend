import { useMemo } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { useQueryParams, useStringParam } from '@/shared/router/listState';
import { useCursorPagination } from '@/shared/pagination';
import { decodeSort, PAGINATION_PARAM_NAMES, PAGINATION_RESETS, parsePageSize } from '@/shared/pagination/urlSync';
import { Button, Callout, DataTable, PageHeader, Select, StatusChip, type Column } from '@/shared/ui';
import { formatCases, formatDateTime, formatMoney } from '@/shared/lib';
import { useWarehouses } from '@/features/warehouses/hooks';
import { useReceiptUserNames } from '@/features/receipts/userNames';
import { useDisposalCandidates, useDisposalLineTotalsForPage, useDisposalsPage } from '../hooks';
import {
  DISPOSALS_PAGE_SIZES,
  DISPOSALS_SORT_MAP,
  DISPOSALS_SORTABLE_FIELDS,
  disposalMethodOf,
  type DisposalSortField,
  type DisposalsPageSize,
} from '../disposalGraphql';
import type { Disposal } from '../types';

const PAGE_RESETS = PAGINATION_RESETS;

export function DisposalPage() {
  const navigate = useNavigate();
  const { params } = useQueryParams();
  const candidates = useDisposalCandidates();

  const after = params.get('after') ?? undefined;
  const before = after ? undefined : (params.get('before') ?? undefined);
  const pageSize = parsePageSize(params.get('size'), DISPOSALS_PAGE_SIZES, 20) as DisposalsPageSize;
  const search = params.get('q') ?? undefined;
  const [warehouseId, setWarehouseId] = useStringParam('wh', { resets: PAGE_RESETS });

  const rawSort = decodeSort(params.get(PAGINATION_PARAM_NAMES.SORT));
  const activeSort = rawSort?.field && DISPOSALS_SORT_MAP[rawSort.field as DisposalSortField]
    ? { field: rawSort.field as DisposalSortField, direction: rawSort.direction }
    : undefined;

  // Warehouse names/codes stay on REST (WriteOff has no navigation to Warehouse).
  const { data: warehouses = [] } = useWarehouses();
  const warehouseById = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  const searchWarehouseIds = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return warehouses
      .filter((w) => w.name?.toLowerCase().includes(q) || w.code?.toLowerCase().includes(q))
      .map((w) => w.id)
      .filter((id): id is string => !!id);
  }, [warehouses, search]);

  const query = useDisposalsPage({
    size: pageSize,
    after,
    before,
    warehouseId: warehouseId || undefined,
    search,
    searchWarehouseIds: search ? searchWarehouseIds : undefined,
    sort: activeSort,
  });

  const { pagingProps, sortProps } = useCursorPagination({
    pageInfo: query.data?.pageInfo,
    totalCount: query.data?.totalCount,
    loading: query.isLoading || query.isFetching,
    error: query.isPlaceholderData ? undefined : query.error,
    defaultPageSize: 20,
    pageSizeOptions: DISPOSALS_PAGE_SIZES,
    urlState: true,
  });

  const pageIds = useMemo(() => (query.data?.rows ?? []).map((r) => r.id), [query.data?.rows]);
  const totalsQuery = useDisposalLineTotalsForPage(pageIds);
  const users = useReceiptUserNames((query.data?.rows ?? []).map((r) => r.createdByUserId));

  const rows = useMemo(
    () => (query.data?.rows ?? []).map((r) => {
      const wh = warehouseById.get(r.warehouseId);
      const t = totalsQuery.data?.get(r.id);
      return {
        code: r.writeOffCode,
        warehouseCode: wh?.code ?? '',
        warehouseName: wh?.name ?? '',
        createdAt: r.createdAt,
        createdBy: users.nameOf(r.createdByUserId),
        reason: r.reason ?? '',
        method: disposalMethodOf(r.reason),
        batchCount: t?.batchCount ?? 0,
        totalQty: t?.totalQty ?? 0,
        totalValue: null, // Backend never computes a value for write-offs (REST returns null too)
        lines: [],
      } as Disposal;
    }),
    [query.data?.rows, warehouseById, totalsQuery.data, users],
  );

  const columns: Column<Disposal>[] = [
    { key: 'code', header: 'Mã phiếu', width: '130px', sortable: true, render: (d) => <span className="bold">{d.code}</span> },
    { key: 'wh', header: 'Kho', text: (d) => d.warehouseName },
    { key: 'at', header: 'Thời gian', width: '150px', sortable: true, text: (d) => formatDateTime(d.createdAt) },
    { key: 'by', header: 'Người lập', width: '150px', text: (d) => d.createdBy },
    { key: 'method', header: 'Hình thức', width: '150px', text: (d) => d.method },
    { key: 'batches', header: 'Số lô hàng', width: '85px', align: 'right', text: (d) => d.batchCount },
    { key: 'qty', header: 'Tổng SL', width: '100px', align: 'right', text: (d) => formatCases(d.totalQty) },
    { key: 'value', header: 'Giá trị', width: '120px', align: 'right', text: (d) => formatMoney(d.totalValue) },
    { key: 'status', header: 'Trạng thái', width: '115px', render: () => <StatusChip domain="disposal" value="Disposed" /> },
  ];
  const n = candidates.data?.length ?? 0;
  return (
    <>
      <PageHeader title="Hủy hàng hết hạn" subtitle="Lập phiếu hủy cho lô hàng đã quá hạn sử dụng; sau khi hủy tồn lô hàng về 0." actions={<Button variant="primary" onClick={() => navigate('/disposal/new')}>+ Lập phiếu hủy</Button>} />
      {n > 0 && <Callout tone="warn">Có {n} lô hàng đã hết hạn còn tồn kho, cần lập phiếu hủy.</Callout>}
      <DataTable
        title="Phiếu hủy hàng"
        rows={rows}
        loading={query.isLoading || query.isPlaceholderData}
        error={query.isPlaceholderData ? undefined : query.error}
        rowKey={(d) => d.code}
        columns={columns}
        summaryColumns={['code', 'wh', 'at', 'qty', 'value', 'status']}
        searchPlaceholder="Mã phiếu, kho…"
        cursor={pagingProps}
        serverSort={{ ...sortProps, sortableFields: DISPOSALS_SORTABLE_FIELDS }}
        filterExtra={
          <label className="lbl">
            Kho
            <Select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              options={[
                { value: '', label: 'Tất cả' },
                ...warehouses.filter((w) => w.id).map((w) => ({ value: w.id as string, label: w.name })),
              ]}
            />
          </label>
        }
        onRowClick={(d) => navigate(`/disposal/${d.code}`)}
      />
    </>
  );
}
