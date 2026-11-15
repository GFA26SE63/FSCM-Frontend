import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useAuth } from '@/shared/auth/AuthContext';
import { useApiMutation } from '@/shared/hooks';

import { receiptApi } from './api';

export function useReceipts(warehouseId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['receipts', 'list', user?.id, warehouseId ?? 'all'],
    queryFn: () => receiptApi.list(warehouseId),
    enabled: Boolean(user),
    gcTime: 0,
  });
}

export function useReceipt(idOrCode: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['receipts', 'detail', user?.id, idOrCode],
    queryFn: () => receiptApi.get(idOrCode),
    enabled: Boolean(user && idOrCode.trim()),
    retry: false,
    gcTime: 0,
  });
}

export function useReceiptLookups() {
  const { user } = useAuth();

  const warehouses = useQuery({
    queryKey: ['receipts', 'warehouses', user?.id],
    queryFn: receiptApi.warehouses,
    enabled: Boolean(user),
    gcTime: 0,
  });

  const products = useQuery({
    queryKey: ['receipts', 'products', user?.id],
    queryFn: receiptApi.products,
    enabled: Boolean(user),
    gcTime: 0,
  });

  return {
    warehouses,
    products,
  };
}

export function useCreateReceipt() {
  const queryClient = useQueryClient();

  return useApiMutation(receiptApi.create, {
    success: (r) => `Đã tạo phiếu nhập ${r.receiptCode}.`,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['receipts'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['batches'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['inventory'],
      });
    },
  });
}

export function useApproveReceipt() {
  const queryClient = useQueryClient();

  return useApiMutation(receiptApi.approve, {
    permission: 'receipts.approve',
    success: (r) => {
      if (r.status === 'Received') {
        const hasBatches =
          Array.isArray(r.lines) && r.lines.some((l) => Boolean(l.batchId));
        if (hasBatches) {
          return `Đã duyệt phiếu nhập ${r.receiptCode}. Tồn kho vật lý và lô hàng đã được ghi nhận thành công.`;
        }
        return `Đã duyệt phiếu nhập ${r.receiptCode}. Đang đồng bộ thông tin lô hàng vào kho.`;
      }
      return `Đã gửi yêu cầu duyệt phiếu nhập ${r.receiptCode}.`;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['receipts'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['batches'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['inventory'],
      });
    },
  });
}
