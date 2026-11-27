/**
 * Order-scoped shipment list via GraphQL `entities.shipments`.
 *
 * Parity with REST `GET /shipments?orderId=` for the fields ShipmentOperations uses
 * (id, orderId, orderCode, warehouseId, warehouseCode, shipmentCode, status, version, totalQuantity,
 * driverId, driverName, vehicleId, plateNumber, exceptionReason):
 *   Shipment entity: id, salesOrderId (= orderId), warehouseId, shipmentCode, status, version, totalQuantity,
 *                    driverId, vehicleId, exceptionReason, driverNameSnapshot, plateNumberSnapshot
 *                    (REST DriverName/PlateNumber are these same snapshot columns — ShipmentService.cs)
 *   warehouseCode  warehouses (shared master data) and orderCode salesOrders — ONE batched request
 * REST also returns `lines` and `receipt`; this screen never reads them, so they are not requested.
 * Scope is enforced server-side by the entity resolver (order scope; keepers also by warehouse), the
 * same roles the REST endpoint scopes. The list stays order-scoped and bounded (one part per warehouse),
 * so it is read with a cursor loop rather than a paged UI. Issue / assign / dispatch / resolve-exception
 * stay REST; drivers/vehicles lookups use GraphQL.
 *
 * Default order: createdAt DESC, id DESC (same as REST's newest-first).
 */
import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import type { Shipment } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** shortcut: an order has one part per warehouse; bounded at 10 pages × 100, raise if ever hit. */
const MAX_PAGES = 10;

interface RawShipment {
  id: string;
  salesOrderId: string;
  warehouseId: string;
  shipmentCode: string;
  status: Shipment['status'];
  version: number;
  totalQuantity: number;
  driverId: string | null;
  vehicleId: string | null;
  exceptionReason: string | null;
  driverNameSnapshot: string | null;
  plateNumberSnapshot: string | null;
}

export const SHIPMENTS_BY_ORDER_QUERY = `query ShipmentsByOrder($orderId: UUID!, $after: String) {
  entities {
    shipments(first: 100, after: $after, where: { salesOrderId: { eq: $orderId } }, order: [{ createdAt: DESC }, { id: DESC }]) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id salesOrderId warehouseId shipmentCode status version totalQuantity
        driverId vehicleId exceptionReason driverNameSnapshot plateNumberSnapshot
      }
    }
  }
}`;

export async function fetchShipmentsForOrder(orderId: string): Promise<Shipment[]> {
  if (!UUID.test(orderId)) throw new ApiError(400, 'Mã đơn hàng không hợp lệ');
  const raw: RawShipment[] = [];
  let after: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const data: {
      entities: { shipments: { pageInfo?: { hasNextPage: boolean; endCursor: string | null }; nodes: RawShipment[] | null } };
    } = await graphql(SHIPMENTS_BY_ORDER_QUERY, { orderId, after });
    const conn = data.entities?.shipments;
    if (!conn || !Array.isArray(conn.nodes)) {
      throw new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi phiếu giao hàng không hợp lệ.');
    }
    raw.push(...conn.nodes);
    const next = conn.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : null;
    if (!next || next === after) break;
    after = next;
  }
  if (raw.length === 0) return [];

  const warehouseIds = [...new Set(raw.map((s) => s.warehouseId))];
  const extra = await graphql<{
    entities: {
      warehouses?: { nodes: { id: string; code: string }[] | null };
      salesOrders?: { nodes: { id: string; orderCode: string }[] | null };
    };
  }>(
    `query ShipmentEnrich($warehouseIds: [UUID!]!, $orderId: UUID!) {
  entities {
    warehouses(first: 100, where: { id: { in: $warehouseIds } }) { nodes { id code } }
    salesOrders(first: 1, where: { id: { eq: $orderId } }) { nodes { id orderCode } }
  }
}`,
    { warehouseIds, orderId },
  );
  const warehouses = extra.entities?.warehouses?.nodes;
  const orders = extra.entities?.salesOrders?.nodes;
  if (!Array.isArray(warehouses) || !Array.isArray(orders)) {
    throw new ApiError(502, 'Không tải được dữ liệu', 'Phản hồi thông tin phiếu giao hàng không hợp lệ.');
  }
  const codeOf = new Map(warehouses.map((w) => [w.id, w.code]));
  const orderCode = orders[0]?.orderCode ?? '';

  return raw.map((s) => ({
    id: s.id,
    orderId: s.salesOrderId,
    orderCode,
    warehouseId: s.warehouseId,
    warehouseCode: codeOf.get(s.warehouseId) ?? '',
    shipmentCode: s.shipmentCode,
    status: s.status,
    version: s.version,
    totalQuantity: s.totalQuantity,
    driverId: s.driverId,
    driverName: s.driverNameSnapshot,
    vehicleId: s.vehicleId,
    plateNumber: s.plateNumberSnapshot,
    exceptionReason: s.exceptionReason,
  }));
}
