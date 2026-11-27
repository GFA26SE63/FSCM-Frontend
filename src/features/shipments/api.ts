import { getAll, patch, post } from '@/shared/api/http';
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
  readiness: async (orderId: string): Promise<OrderShipmentReadiness> => {
    const data = await graphql<{ entities: { shipmentReadinessRead: OrderShipmentReadiness } }>(`
      query ShipmentReadiness($orderId: UUID!) {
        entities { shipmentReadinessRead(orderId: $orderId) {
          salesOrderId orderCode isReady paymentSettled hasException dispatchStatus isHistory
          blockingReasons parts { shipmentId shipmentCode warehouseId warehouseCode status exceptionReason }
        } }
      }
    `, { orderId });
    return data.entities.shipmentReadinessRead;
  },
  /** Order-scoped read via GraphQL (see shipmentsGraphql.ts); writes below stay REST. */
  list: (orderId: string) => fetchShipmentsForOrder(orderId),
  drivers: () => getAll<DeliveryDriver>('/deliveries/drivers', { includeInactive: false }),
  vehicles: () => getAll<DeliveryVehicle>('/deliveries/vehicles', { includeInactive: false }),
  assignTransfer: (input: { transferId: string; driverId: string; vehicleId: string; expectedVersion: number }) =>
    post<void>(`/transport-dispatches/transfers/${input.transferId}/assignment`, {
      driverId: input.driverId, vehicleId: input.vehicleId, expectedVersion: input.expectedVersion,
    }),
  busyAssignments: async () => {
    const data = await graphql<{ entities: { busyTransportRead: { driverIds: string[]; vehicleIds: string[] } } }>(`
      query BusyTransport { entities { busyTransportRead { driverIds vehicleIds } } }
    `);
    const busy = data.entities.busyTransportRead;
    return { busyDriverIds: new Set(busy.driverIds), busyVehicleIds: new Set(busy.vehicleIds) };
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
