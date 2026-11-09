import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useAuth } from '@/shared/auth/AuthContext';
import { useApiMutation } from '@/shared/hooks';

import { receiptApi } from './api';

export function useReceipts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['receipts', 'list', user?.id],
    queryFn: receiptApi.list,
    enabled: Boolean(user),
    gcTime: 0,
  });
}

export function useReceipt(idOrCode: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [
      'receipts',
      'detail',
      user?.id,
      idOrCode,
    ],
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
    success: () => 'Đã tạo phiếu nhập.',
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['receipts'],
      });

      void queryClient.invalidateQueries({
        queryKey: ['batches'],
      });
    },
  });
}