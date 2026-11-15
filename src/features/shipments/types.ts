/**
 * F93: whether a whole order may leave its warehouses, and what is holding it.
 *
 * The verdict belongs to the server and is taken for the order, never for one warehouse. An order
 * is all or nothing at the door: every warehouse part must be picked and the payment condition met
 * before any part moves, so one warehouse short or damaged holds every other part too.
 */
export type ShipmentPartStatus =
  | 'WaitingToPick'
  | 'Ready'
  | 'Issued'
  | 'Delivering'
  | 'Received'
  | 'Exception';

export interface ShipmentReadinessPart {
  /**
   * Null while that warehouse has not closed its picking sheet: a shipment part is only created
   * at that point. Such a warehouse is still reported, because it is the one holding the order —
   * leaving it out of the list is what once made a half-picked order read as ready.
   */
  shipmentId: string | null;
  shipmentCode: string | null;
  warehouseId: string;
  warehouseCode: string;
  status: ShipmentPartStatus;
  exceptionReason: string | null;
}

export interface OrderShipmentReadiness {
  salesOrderId: string;
  orderCode: string;
  /** The only thing an issue action may be enabled on. The rest of this record explains it. */
  isReady: boolean;
  paymentSettled: boolean;
  hasException: boolean;
  blockingReasons: string[];
  parts: ShipmentReadinessPart[];
}

/** Lightweight metadata for ordering the export list by actual order creation time. */
export interface ExportOrder {
  id: string;
  orderCode: string;
  createdAt: string;
}

/** Statuses that mean the goods have physically left that warehouse. */
export const HAS_LEFT: ShipmentPartStatus[] = ['Issued', 'Delivering', 'Received'];

export interface Shipment {
  exceptionReason?: string | null;
  id: string;
  orderId: string;
  orderCode: string;
  warehouseId: string;
  warehouseCode: string;
  shipmentCode: string;
  status: ShipmentPartStatus;
  version: number;
  totalQuantity: number;
  driverId: string | null;
  driverName: string | null;
  vehicleId: string | null;
  plateNumber: string | null;
}

export interface DeliveryDriver {
  id: string;
  warehouseId: string;
  code: string;
  fullName: string;
  isActive: boolean;
}

export interface DeliveryVehicle {
  id: string;
  warehouseId: string;
  plateNumber: string;
  vehicleType: string;
  capacity: number;
  isActive: boolean;
}
