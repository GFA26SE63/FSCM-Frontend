import { get, getAll, post } from '@/shared/api/http';
import type { OrderDetail, OrderSummary, OrderTraceDetail } from './types';

export const orderApi = {
  list: () => getAll<OrderSummary>('/orders'),
  get: (orderId: string) => get<OrderDetail>(`/orders/${orderId}`),
  /** Why the run chose these batches. The price those batches ended at is a separate record (F98). */
  trace: (orderId: string) => get<OrderTraceDetail>(`/allocation-runs/orders/${orderId}/trace`),
  approve: (code: string) => post<OrderDetail>(`/orders/${code}/approve`),
  reject: (v: { code: string; reason: string }) => post<OrderDetail>(`/orders/${v.code}/reject`, { reason: v.reason }),
  cancel: (v: { code: string; reason: string }) => post<OrderDetail>(`/orders/${v.code}/cancel`, { reason: v.reason }),
  /** Operator picks vehicle + driver from the master-data dropdowns; the order keeps a snapshot. */
  dispatch: (v: { code: string; plate: string; driverCode: string }) => post<OrderDetail>(`/orders/${v.code}/dispatch`, { plate: v.plate, driverCode: v.driverCode }),
  vehicles: () => getAll<DispatchVehicle>('/vehicles'),
  drivers: () => getAll<DispatchDriver>('/drivers'),
};
