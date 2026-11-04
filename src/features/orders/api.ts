import { get, getAll, post } from '@/shared/api/http';
import type {
  DispatchDriver,
  DispatchVehicle,
  OrderDetail,
  OrderSummary,
} from './types';

export const orderApi = {
  list: () => getAll<OrderSummary>('/orders'),
  get: (orderId: string) => get<OrderDetail>(`/orders/${orderId}`),
  approve: (v: { orderId: string; expectedVersion: number }) =>
    post<OrderDetail>(`/orders/${v.orderId}/approve`, { expectedVersion: v.expectedVersion }),
  reject: (v: { orderId: string; expectedVersion: number; reason: string }) =>
    post<OrderDetail>(`/orders/${v.orderId}/reject`, {
      expectedVersion: v.expectedVersion,
      reason: v.reason,
    }),
  cancel: (v: { orderId: string; expectedVersion: number; reason: string }) =>
    post<OrderDetail>(`/orders/${v.orderId}/cancel`, {
      expectedVersion: v.expectedVersion,
      reason: v.reason,
    }),
  /** Operator picks vehicle + driver from the master-data dropdowns; the order keeps a snapshot. */
  dispatch: (v: { code: string; plate: string; driverCode: string }) => post<OrderDetail>(`/orders/${v.code}/dispatch`, { plate: v.plate, driverCode: v.driverCode }),
  vehicles: () => getAll<DispatchVehicle>('/vehicles'),
  drivers: () => getAll<DispatchDriver>('/drivers'),
};
