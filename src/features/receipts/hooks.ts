import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { receiptApi } from './api';

export const useReceipts = () => useQuery({ queryKey: ['receipts', 'list'], queryFn: receiptApi.list });
export const useReceipt = (code: string) => useQuery({ queryKey: ['receipts', 'detail', code], queryFn: () => receiptApi.get(code) });
export const useReceiptLookups = () => ({
  warehouses: useQuery({ queryKey: ['receipts', 'warehouses'], queryFn: receiptApi.warehouses }),
  products: useQuery({ queryKey: ['receipts', 'products'], queryFn: receiptApi.products }),
});
export const useCreateReceipt = () => useApiMutation(receiptApi.create, { success: (r) => `Đã tạo phiếu nhập ${r.code} (${r.batchCount} batch) và in tem batch.` });
