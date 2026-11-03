import { get, getAll, patch, post } from '@/shared/api/http';
import type { DeliveryDriver, DeliveryVehicle, OrderShipmentReadiness, Shipment } from './types';

export const shipmentsApi = {
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
};
