import { get, getAll, patch, post } from '@/shared/api/http';
import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import { fetchShipmentsForOrder } from './shipmentsGraphql';
import type { DeliveryDriver, DeliveryVehicle, ExportOrder, OrderShipmentReadiness, Shipment } from './types';

async function exportOrders(orderIds: string[]): Promise<ExportOrder[]> {
  const ids = [...new Set(orderIds)];
  const rows: ExportOrder[] = [];
  // Read metadata only, avoiding the REST order list's per-order pricing/detail hydration.
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const data = await graphql<{ entities: { salesOrders: { nodes: ExportOrder[] } } }>(`
      query ExportOrders($ids: [UUID!]!) {
        entities {
          salesOrders(first: 100, where: { id: { in: $ids } }) {
            nodes { id orderCode createdAt }
          }
        }
      }
    `, { ids: batch });
    const nodes = data.entities?.salesOrders?.nodes;
    if (!Array.isArray(nodes) || batch.some(id => !nodes.some(row => row.id === id)) ||
        nodes.some(row => !row.id || !row.orderCode || !Number.isFinite(Date.parse(row.createdAt)))) {
      throw new ApiError(502, 'Chưa tải đầy đủ thông tin đơn hàng để sắp xếp.');
    }
    rows.push(...nodes);
  }
  return rows;
}

export const shipmentsApi = {
  exportOrders,
  /**
   * F93. Asked per order, because that is the unit the answer is about — there is no endpoint that
   * lists blocked orders, and inventing the verdict from the picking sheets would be wrong: an
   * order draws from warehouses a sheet knows nothing about and is gated on a payment the Portal
   * has no view of.
   */
  readiness: (orderId: string) => get<OrderShipmentReadiness>(`/shipments/orders/${orderId}/readiness`),
  /** Order-scoped read via GraphQL (see shipmentsGraphql.ts); writes below stay REST. */
  list: (orderId: string) => fetchShipmentsForOrder(orderId),
  drivers: () => getAll<DeliveryDriver>('/deliveries/drivers', { includeInactive: false }),
  vehicles: () => getAll<DeliveryVehicle>('/deliveries/vehicles', { includeInactive: false }),
  busyAssignments: async () => {
    type ActiveAssignment = { status: string; driverId: string | null; vehicleId: string | null };
    type AssignmentConnection = {
      nodes: ActiveAssignment[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };

    // Fetch separately and page the narrow active set. A single query asking for 500
    // rows from both connections exceeds Hot Chocolate's request-cost safeguard.
    const loadActiveAssignments = async (entity: 'shipments' | 'warehouseTransfers', status: string) => {
      const assignments: ActiveAssignment[] = [];
      let after: string | null = null;
      do {
        const data: { entities: Record<'shipments' | 'warehouseTransfers', AssignmentConnection> } = await graphql<{ entities: Record<'shipments' | 'warehouseTransfers', AssignmentConnection> }>(`
          query BusyTransportAssignments($after: String) {
            entities {
              ${entity}(first: 50, after: $after, where: { status: { eq: "${status}" } }) {
                nodes { status driverId vehicleId }
                pageInfo { hasNextPage endCursor }
              }
            }
          }
        `, { after });
        const page: AssignmentConnection = data.entities[entity];
        assignments.push(...page.nodes.filter(item => item.status === status));
        // Older client mocks (and an empty connection from older API deployments)
        // may omit pageInfo; in that case the received page is the complete result.
        after = page.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
      } while (after);
      return assignments;
    };

    const [shipments, warehouseTransfers] = await Promise.all([
      loadActiveAssignments('shipments', 'Delivering'),
      loadActiveAssignments('warehouseTransfers', 'InTransit'),
    ]);
    const busyDriverIds = new Set<string>(), busyVehicleIds = new Set<string>();
    for (const item of shipments) { if (item.driverId) busyDriverIds.add(item.driverId); if (item.vehicleId) busyVehicleIds.add(item.vehicleId); }
    for (const item of warehouseTransfers) { if (item.driverId) busyDriverIds.add(item.driverId); if (item.vehicleId) busyVehicleIds.add(item.vehicleId); }
    return { busyDriverIds, busyVehicleIds };
  },
  issue: (shipment: Shipment) =>
    post<Shipment>(`/shipments/${shipment.id}/issue`, { expectedVersion: shipment.version }),
  assign: (input: { shipment: Shipment; driverId: string; vehicleId: string }) =>
    patch<Shipment>(`/shipments/${input.shipment.id}/assignment`, {
      driverId: input.driverId,
      vehicleId: input.vehicleId,
      expectedVersion: input.shipment.version,
    }),
  dispatch: (shipment: Shipment) =>
    post<Shipment>(`/shipments/${shipment.id}/dispatch`, { expectedVersion: shipment.version }),
  resolveException: ({ shipment, reason }: { shipment: Shipment; reason: string }) =>
    post<Shipment>(`/shipments/${shipment.id}/exception/resolve`, { reason: reason.trim(), expectedVersion: shipment.version }),
};
