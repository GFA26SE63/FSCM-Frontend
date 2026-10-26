import { get, getAll, post } from '@/shared/api/http';
import type { OrderDetail, OrderSummary, OrderTraceDetail } from './types';

export const orderApi = {
  list: () => getAll<OrderSummary>('/orders'),
  get: (orderId: string) => get<OrderDetail>(`/orders/${orderId}`),
  /** Why the run chose these batches. The price those batches ended at is a separate record (F98). */
  trace: (orderId: string) => get<OrderTraceDetail>(`/allocation-runs/orders/${orderId}/trace`),
  approve: (v: { orderId: string; expectedVersion: number }) =>
    post<OrderDetail>(`/orders/${v.orderId}/approve`, { expectedVersion: v.expectedVersion }),
  reject: (v: { orderId: string; expectedVersion: number; reason: string }) =>
    post<OrderDetail>(`/orders/${v.orderId}/reject`, { expectedVersion: v.expectedVersion, reason: v.reason }),
  cancel: (v: { orderId: string; expectedVersion: number; reason: string }) =>
    post<OrderDetail>(`/orders/${v.orderId}/cancel`, { expectedVersion: v.expectedVersion, reason: v.reason }),
};
