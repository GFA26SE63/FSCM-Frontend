import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { orderApi } from './api';

export const orderKeys = {
  all: ['orders'] as const,
  list: ['orders', 'list'] as const,
  detail: (orderId: string) => ['orders', 'detail', orderId] as const,
  trace: (orderId: string) => ['orders', 'trace', orderId] as const,
};

export const useOrders = () => useQuery({ queryKey: orderKeys.list, queryFn: orderApi.list });
export const useOrder = (orderId: string) => useQuery({ queryKey: orderKeys.detail(orderId), queryFn: () => orderApi.get(orderId), enabled: !!orderId });
export const useAllocationTrace = (orderId: string, enabled: boolean) => useQuery({ queryKey: orderKeys.trace(orderId), queryFn: () => orderApi.trace(orderId), enabled: enabled && !!orderId });
export const useApproveOrder = () => useApiMutation(orderApi.approve, { success: (o) => `Đã duyệt đơn ${o.orderCode} để chờ đợt phân bổ.` });
export const useRejectOrder = () => useApiMutation(orderApi.reject, { success: (o) => `Đã từ chối đơn ${o.orderCode}.` });
export const useCancelOrder = () => useApiMutation(orderApi.cancel, { success: (o) => `Đã hủy đơn ${o.orderCode}.` });
