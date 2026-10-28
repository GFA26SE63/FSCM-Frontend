import { get } from '@/shared/api/http';
import type { OrderShipmentReadiness } from './types';

export const shipmentsApi = {
  /**
   * F93. Asked per order, because that is the unit the answer is about — there is no endpoint that
   * lists blocked orders, and inventing the verdict from the picking sheets would be wrong: an
   * order draws from warehouses a sheet knows nothing about and is gated on a payment the Portal
   * has no view of.
   */
  readiness: (orderId: string) => get<OrderShipmentReadiness>(`/shipments/orders/${orderId}/readiness`),
};
