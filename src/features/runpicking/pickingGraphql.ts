import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import type { PickingListPage, PickingListRow, PickingRowItem, PickingStatus } from './types';

/**
 * Phiếu soạn hàng qua GraphQL `entities.pickingLists` (phân trang cursor của Backend).
 *
 * Ràng buộc của Backend (đã kiểm chứng):
 *  - `first`/`last` và khung `where` phải là literal trong câu truy vấn; truyền qua biến thì bộ
 *    phân tích chi phí từ chối (HC0047). Chỉ các giá trị đơn (id, mã, trạng thái, cursor) đi qua biến.
 *  - `entities.*` không tự giới hạn theo kho được phân công → Thủ kho luôn kèm `warehouseId in` phạm vi.
 *  - Mã đơn / retailer: pickingItems.allocationId → allocations → salesOrderLines → salesOrders.
 */

export const PICKING_STATUSES: PickingStatus[] = ['Pending', 'InProgress', 'Completed', 'Exception'];
export const PAGE_SIZES = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
const LOOKUP_PAGE = 100;

export interface PickingPageQuery {
  size: PageSize;
  /** Cursor trang sau (first/after) hoặc trang trước (last/before); tối đa một trong hai. */
  after?: string;
  before?: string;
  warehouseId?: string;
  status?: PickingStatus | '';
  pickingCode?: string;
  /** Kho được phép xem; undefined = không giới hạn (Admin / Operator). */
  scopeWarehouseIds?: string[];
}

interface Connection<T> {
  totalCount?: number;
  pageInfo?: { hasNextPage: boolean; hasPreviousPage: boolean; startCursor: string | null; endCursor: string | null };
  nodes?: T[] | null;
}

interface ListNode {
  id: string;
  pickingCode: string;
  warehouseId: string;
  status: string;
  startedAt: string | null;
  confirmedAt: string | null;
}

/** Điều kiện lọc dạng literal + khai báo biến tương ứng (chỉ cho điều kiện đang dùng). */
function buildFilter(q: PickingPageQuery) {
  const conditions: string[] = [];
  const declarations: string[] = [];
  const variables: Record<string, unknown> = {};
  if (q.scopeWarehouseIds) {
    conditions.push('{ warehouseId: { in: $scope } }');
    declarations.push('$scope: [UUID!]!');
    variables.scope = q.scopeWarehouseIds;
  }
  if (q.warehouseId) {
    conditions.push('{ warehouseId: { eq: $wh } }');
    declarations.push('$wh: UUID!');
    variables.wh = q.warehouseId;
  }
  if (q.status) {
    conditions.push('{ status: { eq: $st } }');
    declarations.push('$st: String!');
    variables.st = q.status;
  }
  if (q.pickingCode) {
    conditions.push('{ pickingCode: { eq: $code } }');
    declarations.push('$code: String!');
    variables.code = q.pickingCode;
  }
  return { conditions, declarations, variables };
}

const whereOf = (conditions: string[]) => (conditions.length ? `where: { and: [${conditions.join(', ')}] }` : '');

export function buildPickingPageQuery(q: PickingPageQuery) {
  if (!PAGE_SIZES.includes(q.size)) throw new Error('invalid page size');
  const { conditions, declarations, variables } = buildFilter(q);
  const backward = !!q.before;
  const paging = backward ? `last: ${q.size}, before: $before` : `first: ${q.size}${q.after ? ', after: $after' : ''}`;
  if (backward) {
    declarations.push('$before: String!');
    variables.before = q.before;
  } else if (q.after) {
    declarations.push('$after: String!');
    variables.after = q.after;
  }
  const order = 'order: [{ createdAt: DESC }, { id: DESC }]';
  // Thống kê theo trạng thái: chỉ đếm (totalCount) trên cùng bộ lọc.
  const count = (alias: string, status: PickingStatus) =>
    `${alias}: pickingLists(first: 1, ${whereOf([...conditions, `{ status: { eq: "${status}" } }`])}) { totalCount }`;
  const decl = declarations.length ? `(${declarations.join(', ')})` : '';
  const query = `query PickingListPage${decl} {
  entities {
    page: pickingLists(${[paging, whereOf(conditions), order].filter(Boolean).join(', ')}) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      nodes { id pickingCode warehouseId status startedAt confirmedAt }
    }
    ${count('inProgress', 'InProgress')}
    ${count('completed', 'Completed')}
    ${count('exception', 'Exception')}
  }
}`;
  return { query, variables };
}

/** Lấy các entity theo danh sách id (theo lô 100, đi hết các trang cursor). */
async function fetchByIds<T>(field: string, key: string, ids: string[], selection: string): Promise<T[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out: T[] = [];
  for (let i = 0; i < unique.length; i += LOOKUP_PAGE) {
    const chunk = unique.slice(i, i + LOOKUP_PAGE);
    let after: string | null = null;
    for (;;) {
      const query: string = `query Lookup($ids: [UUID!]!${after ? ', $after: String!' : ''}) {
  entities { ${field}(first: ${LOOKUP_PAGE}${after ? ', after: $after' : ''}, where: { ${key}: { in: $ids } }) {
    pageInfo { hasNextPage endCursor } nodes { ${selection} } } } }`;
      const data: { entities: Record<string, Connection<T>> } = await graphql(query, after ? { ids: chunk, after } : { ids: chunk });
      const conn: Connection<T> | undefined = data.entities?.[field];
      if (!conn?.pageInfo || !Array.isArray(conn.nodes)) throw missingData();
      out.push(...conn.nodes);
      if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
      after = conn.pageInfo.endCursor;
    }
  }
  return out;
}

const missingData = () => new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi phiếu soạn hàng thiếu thông tin phân trang.');

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v));

/** Lỗi GraphQL → thông báo nghiệp vụ (không hiển thị nội dung kỹ thuật của Backend). */
function friendlyError(err: unknown, q: PickingPageQuery): unknown {
  if (!(err instanceof ApiError)) return err;
  if (err.status === 401) return err;
  if (err.status === 403) return new ApiError(403, 'Không có quyền', 'Tài khoản không có quyền xem phiếu soạn hàng.', err.code);
  if (err.status === 400 && (q.after || q.before) && (err.code === 'HC0078' || /cursor/i.test(err.message))) {
    return new ApiError(400, 'Trang không hợp lệ', 'Trang đã chọn không còn hợp lệ. Hãy quay về trang đầu.', err.code);
  }
  if (err.status === 400) return new ApiError(400, 'Không tải được dữ liệu', 'Không tải được danh sách phiếu soạn hàng. Vui lòng thử lại.', err.code);
  return err;
}

export async function fetchPickingListPage(q: PickingPageQuery): Promise<PickingListPage> {
  try {
    return await loadPage(q);
  } catch (err) {
    throw friendlyError(err, q);
  }
}

async function loadPage(q: PickingPageQuery): Promise<PickingListPage> {
  const { query, variables } = buildPickingPageQuery(q);
  const data = await graphql<{ entities: Record<string, Connection<ListNode>> }>(query, variables);
  const page = data.entities?.page;
  const counts = ['inProgress', 'completed', 'exception'].map((k) => data.entities?.[k]?.totalCount);
  if (!page || typeof page.totalCount !== 'number' || !page.pageInfo || !Array.isArray(page.nodes) || counts.some((c) => typeof c !== 'number')) {
    throw missingData();
  }
  const lists = page.nodes;
  const rows = await hydrate(lists);
  return {
    rows,
    totalCount: page.totalCount,
    pageInfo: page.pageInfo,
    statusCounts: { InProgress: counts[0] as number, Completed: counts[1] as number, Exception: counts[2] as number },
  };
}

interface ItemNode { id: string; pickingListId: string; allocationId: string; sourceBatchId: string; requestedQuantity: number; pickedQuantity: number; status: string }
interface AllocationNode { id: string; salesOrderLineId: string }
interface LineNode { id: string; salesOrderId: string; skuSnapshot: string; productNameSnapshot: string }
interface OrderNode { id: string; orderCode: string; retailerCodeSnapshot: string; retailerNameSnapshot: string }
interface BatchNode { id: string; batchCode: string; expirationDate: string }
interface WarehouseNode { id: string; code: string; name: string }

/** Bổ sung kho, đơn, retailer và dòng hàng cho đúng các phiếu của trang hiện tại. */
async function hydrate(lists: ListNode[]): Promise<PickingListRow[]> {
  if (lists.length === 0) return [];
  const [items, warehouses] = await Promise.all([
    fetchByIds<ItemNode>('pickingItems', 'pickingListId', lists.map((l) => l.id),
      'id pickingListId allocationId sourceBatchId requestedQuantity pickedQuantity status'),
    fetchByIds<WarehouseNode>('warehouses', 'id', lists.map((l) => l.warehouseId), 'id code name'),
  ]);
  const [allocations, batches] = await Promise.all([
    fetchByIds<AllocationNode>('allocations', 'id', items.map((i) => i.allocationId), 'id salesOrderLineId'),
    fetchByIds<BatchNode>('batches', 'id', items.map((i) => i.sourceBatchId), 'id batchCode expirationDate'),
  ]);
  const lines = await fetchByIds<LineNode>('salesOrderLines', 'id', allocations.map((a) => a.salesOrderLineId),
    'id salesOrderId skuSnapshot productNameSnapshot');
  const orders = await fetchByIds<OrderNode>('salesOrders', 'id', lines.map((l) => l.salesOrderId),
    'id orderCode retailerCodeSnapshot retailerNameSnapshot');

  const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const allocationById = byId(allocations);
  const lineById = byId(lines);
  const orderById = byId(orders);
  const batchById = byId(batches);
  const warehouseById = byId(warehouses);

  return lists.map((list) => {
    const listItems = items.filter((i) => i.pickingListId === list.id);
    const resolvedItems: PickingRowItem[] = listItems.map((item) => {
      const line = lineById.get(allocationById.get(item.allocationId)?.salesOrderLineId ?? '');
      const batch = batchById.get(item.sourceBatchId);
      const requested = num(item.requestedQuantity);
      const picked = num(item.pickedQuantity);
      return {
        id: item.id,
        sku: line?.skuSnapshot ?? '',
        productName: line?.productNameSnapshot ?? '',
        batchCode: batch?.batchCode ?? '',
        expirationDate: batch?.expirationDate ?? '',
        requestedQuantity: requested,
        pickedQuantity: picked,
        remainingQuantity: requested - picked,
        status: item.status,
      };
    });
    const firstLine = listItems
      .map((i) => lineById.get(allocationById.get(i.allocationId)?.salesOrderLineId ?? ''))
      .find(Boolean);
    const order = firstLine ? orderById.get(firstLine.salesOrderId) : undefined;
    const warehouse = warehouseById.get(list.warehouseId);
    return {
      id: list.id,
      pickingCode: list.pickingCode,
      warehouseId: list.warehouseId,
      warehouseCode: warehouse?.code ?? '',
      warehouseName: warehouse?.name ?? '',
      orderCode: order?.orderCode ?? '',
      retailerCode: order?.retailerCodeSnapshot ?? '',
      retailerName: order?.retailerNameSnapshot ?? '',
      status: list.status as PickingStatus,
      startedAt: list.startedAt,
      confirmedAt: list.confirmedAt,
      items: resolvedItems,
    };
  });
}
