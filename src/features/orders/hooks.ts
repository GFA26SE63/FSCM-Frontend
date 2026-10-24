import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { orderApi } from './api';

export const orderKeys = {
  all: ['orders'] as const,
  list: ['orders', 'list'] as const,
  detail: (code: string) => ['orders', 'detail', code] as const,
  trace: (code: string) => ['orders', 'trace', code] as const,
};

export const useOrders = () => useQuery({ queryKey: orderKeys.list, queryFn: orderApi.list });
export const useOrder = (code: string) => useQuery({ queryKey: orderKeys.detail(code), queryFn: () => orderApi.get(code) });
export const useAllocationTrace = (orderId: string, enabled: boolean) => useQuery({ queryKey: orderKeys.trace(orderId), queryFn: () => orderApi.trace(orderId), enabled: enabled && !!orderId });
export const useDispatchOptions = (enabled: boolean) => ({
  vehicles: useQuery({ queryKey: ['dispatch', 'vehicles'], queryFn: orderApi.vehicles, enabled }),
  drivers: useQuery({ queryKey: ['dispatch', 'drivers'], queryFn: orderApi.drivers, enabled }),
});

export const useApproveOrder = () => useApiMutation(orderApi.approve, { success: (o) => `Đã duyệt ${o.code}. Đã sinh picking list theo kho và báo Sales, retailer, Warehouse Keeper.` });
export const useRejectOrder = () => useApiMutation(orderApi.reject, { success: (o) => `Đã từ chối ${o.code}, trả hàng tạm giữ và báo Sales, retailer.` });
export const useCancelOrder = () => useApiMutation(orderApi.cancel, { success: (o) => `Đã hủy ${o.code}, trả lại hàng tạm giữ và báo Sales, retailer.` });
export const useDispatchOrder = () =>
  useApiMutation(orderApi.dispatch, { success: (o) => `Đã chuyển ${o.code} sang Đang giao và báo retailer: ${o.delivery?.driverName} (${o.delivery?.driverPhone}), xe ${o.delivery?.plate}.` });
export const useConfirmReceipt = () => useApiMutation(orderApi.confirmReceipt, { success: (o) => `Mô phỏng retailer quét QR: ${o.code} đã giao.` });
