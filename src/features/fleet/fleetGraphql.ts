/**
 * Fleet lists via GraphQL `entities.vehicles` / `entities.drivers` (HotChocolate cursor pagination).
 *
 * Parity: REST `GET /deliveries/vehicles|drivers?includeInactive=true` returns the Vehicle / Driver
 * entities unchanged (DeliveryStore.ListVehiclesAsync / ListDriversAsync), so every field the screen
 * uses exists on the GraphQL entity:
 *   Vehicle: id, warehouseId, plateNumber, vehicleType, capacity, isActive, createdAt
 *   Driver : id, warehouseId, code, fullName, phone, licenseNumber, isActive, createdAt
 * Admin and Operator (the roles allowed on /fleet) are unscoped for these entities
 * (EntityQueryService.cs). Warehouse names come from the existing REST warehouse lookup
 * (no navigation on the entities). Detail and all writes stay REST.
 *
 * HC0047: first/last must be literals. HC0078: invalid cursor.
 */
import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import type { PageInfo } from '@/shared/pagination/types';
import type { Driver, Vehicle } from './types';

export const FLEET_PAGE_SIZES = [10, 20, 50] as const;
export type FleetPageSize = (typeof FLEET_PAGE_SIZES)[number];
export type FleetKind = 'vehicles' | 'drivers';
export type FleetActivity = 'active' | 'inactive' | '';

interface KindConfig {
  entity: FleetKind;
  fields: string;
  searchFields: readonly string[];
  /** Keys are DataTable column keys; values are entity scalar fields (identical here). */
  sort: Record<string, string>;
}

const KINDS: Record<FleetKind, KindConfig> = {
  vehicles: {
    entity: 'vehicles',
    fields: 'id warehouseId plateNumber vehicleType capacity isActive',
    searchFields: ['plateNumber', 'vehicleType'],
    sort: { plateNumber: 'plateNumber', vehicleType: 'vehicleType', capacity: 'capacity' },
  },
  drivers: {
    entity: 'drivers',
    fields: 'id warehouseId code fullName phone licenseNumber isActive',
    searchFields: ['code', 'fullName', 'phone', 'licenseNumber'],
    sort: { code: 'code', fullName: 'fullName', phone: 'phone', licenseNumber: 'licenseNumber' },
  },
};

export const FLEET_SORTABLE_FIELDS: Record<FleetKind, readonly string[]> = {
  vehicles: Object.keys(KINDS.vehicles.sort),
  drivers: Object.keys(KINDS.drivers.sort),
};

export interface FleetPageQuery {
  kind: FleetKind;
  size: FleetPageSize;
  after?: string;
  before?: string;
  activity?: FleetActivity;
  warehouseId?: string;
  search?: string;
  /** Warehouse IDs whose name/code match `search` — resolved client-side from the warehouse lookup. */
  searchWarehouseIds?: string[];
  sort?: { field: string; direction: 'asc' | 'desc' };
}

export interface FleetPage<T> {
  rows: T[];
  totalCount: number;
  pageInfo: PageInfo;
}

export function buildFleetPageQuery(q: FleetPageQuery): { query: string; variables: Record<string, unknown> } {
  if (!FLEET_PAGE_SIZES.includes(q.size)) throw new Error('invalid page size');
  const cfg = KINDS[q.kind];
  if (!cfg) throw new Error('invalid kind');
  const conditions: string[] = [];
  const declarations: string[] = [];
  const variables: Record<string, unknown> = {};

  if (q.activity === 'active') conditions.push('{ isActive: { eq: true } }');
  if (q.activity === 'inactive') conditions.push('{ isActive: { eq: false } }');
  if (q.warehouseId) {
    conditions.push('{ warehouseId: { eq: $warehouseId } }');
    declarations.push('$warehouseId: UUID!');
    variables.warehouseId = q.warehouseId;
  }
  if (q.search) {
    const or = cfg.searchFields.map((f) => `{ ${f}: { contains: $search } }`);
    declarations.push('$search: String!');
    variables.search = q.search;
    if (q.searchWarehouseIds?.length) {
      or.push('{ warehouseId: { in: $searchWarehouseIds } }');
      declarations.push('$searchWarehouseIds: [UUID!]!');
      variables.searchWarehouseIds = q.searchWarehouseIds;
    }
    conditions.push(`{ or: [${or.join(', ')}] }`);
  }

  const backward = !!q.before;
  const paging = backward
    ? `last: ${q.size}, before: $before`
    : `first: ${q.size}${q.after ? ', after: $after' : ''}`;
  if (backward) {
    declarations.push('$before: String!');
    variables.before = q.before;
  } else if (q.after) {
    declarations.push('$after: String!');
    variables.after = q.after;
  }

  const field = q.sort ? cfg.sort[q.sort.field] : undefined;
  const order = field
    ? `order: [{ ${field}: ${q.sort!.direction === 'asc' ? 'ASC' : 'DESC'} }, { id: DESC }]`
    : 'order: [{ createdAt: DESC }, { id: DESC }]';
  const where = conditions.length ? `where: { and: [${conditions.join(', ')}] }` : '';
  const decl = declarations.length ? `(${declarations.join(', ')})` : '';

  const query = `query FleetPage${decl} {
  entities {
    page: ${cfg.entity}(${[paging, where, order].filter(Boolean).join(', ')}) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      nodes { ${cfg.fields} }
    }
  }
}`;
  return { query, variables };
}

function friendlyError(err: unknown): unknown {
  if (!(err instanceof ApiError)) return err;
  if (err.status === 400 && err.code === 'HC0078') {
    return new ApiError(400, 'Trang không hợp lệ', 'Trang đã chọn không còn hợp lệ. Hãy quay về trang đầu.', err.code);
  }
  if (err.status === 400) {
    return new ApiError(400, 'Không tải được dữ liệu', 'Không tải được danh sách xe và tài xế. Vui lòng thử lại.', err.code);
  }
  return err;
}

export async function fetchFleetPage<T extends Vehicle | Driver>(q: FleetPageQuery): Promise<FleetPage<T>> {
  try {
    const { query, variables } = buildFleetPageQuery(q);
    const data = await graphql<{
      entities: { page: { totalCount?: number; pageInfo?: PageInfo; nodes?: T[] | null } };
    }>(query, variables);
    const page = data.entities?.page;
    if (!page || typeof page.totalCount !== 'number' || !page.pageInfo || !Array.isArray(page.nodes)) {
      throw new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi danh sách thiếu thông tin phân trang.');
    }
    return { rows: page.nodes, totalCount: page.totalCount, pageInfo: page.pageInfo };
  } catch (err) {
    throw friendlyError(err);
  }
}

/** Total rows of one kind (unfiltered) for the tab badge — a one-row request, totalCount only. */
export async function fetchFleetCount(kind: FleetKind): Promise<number> {
  const entity = KINDS[kind].entity;
  const data = await graphql<{ entities: Record<string, { totalCount?: number }> }>(
    `query FleetCount { entities { ${entity}(first: 1) { totalCount } } }`,
    {},
  );
  const n = data.entities?.[entity]?.totalCount;
  if (typeof n !== 'number') throw new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi đếm không hợp lệ.');
  return n;
}
