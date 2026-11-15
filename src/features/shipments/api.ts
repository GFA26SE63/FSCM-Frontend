import { get, getAll, patch, post } from '@/shared/api/http';
import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
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
  list: (orderId: string) => getAll<Shipment>('/shipments', { orderId }),
  drivers: () => getAll<DeliveryDriver>('/deliveries/drivers', { includeInactive: false }),
  vehicles: () => getAll<DeliveryVehicle>('/deliveries/vehicles', { includeInactive: false }),
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
