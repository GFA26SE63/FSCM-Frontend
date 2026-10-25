import { get, getAll, post } from '@/shared/api/http';
import type { AllocationTrace, DispatchDriver, DispatchVehicle, OrderDetail, OrderPrice, OrderSummary } from './types';

export const orderApi = {
  list: () => getAll<OrderSummary>('/orders'),
  get: (code: string) => get<OrderDetail>(`/orders/${code}`),
  price: (id: string) => get<OrderPrice>(`/allocation-runs/orders/${id}/price`),
  trace: (code: string) => get<AllocationTrace>(`/orders/${code}/allocation-trace`),
  approve: (code: string) => post<OrderDetail>(`/orders/${code}/approve`),
  reject: (v: { code: string; reason: string }) => post<OrderDetail>(`/orders/${v.code}/reject`, { reason: v.reason }),
  cancel: (v: { code: string; reason: string }) => post<OrderDetail>(`/orders/${v.code}/cancel`, { reason: v.reason }),
  /** Operator picks vehicle + driver from the master-data dropdowns; the order keeps a snapshot. */
  dispatch: (v: { code: string; plate: string; driverCode: string }) => post<OrderDetail>(`/orders/${v.code}/dispatch`, { plate: v.plate, driverCode: v.driverCode }),
  /** Normally done by the retailer in the mobile app (scan QR); exposed for the mock demo. */
  confirmReceipt: (code: string) => post<OrderDetail>(`/orders/${code}/confirm-receipt`, { qrToken: 'portal-demo' }),
  vehicles: () => getAll<DispatchVehicle>('/vehicles'),
  drivers: () => getAll<DispatchDriver>('/drivers'),
};
