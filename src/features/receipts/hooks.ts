import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { receiptApi } from './api';

export const useReceipts = () => useQuery({ queryKey: ['receipts', 'list'], queryFn: receiptApi.list });
export const useReceipt = (id: string) => useQuery({ queryKey: ['receipts', 'detail', id], queryFn: () => receiptApi.get(id) });
export const useReceiptLookups = () => ({
  warehouses: useQuery({ queryKey: ['receipts', 'warehouses'], queryFn: receiptApi.warehouses }),
  products: useQuery({ queryKey: ['receipts', 'products'], queryFn: receiptApi.products }),
});
export const useCreateReceipt = () => useApiMutation(receiptApi.create, {
  success: (r) => `Đã tạo phiếu ${r.receiptCode}; tồn kho chưa tăng cho tới khi phiếu được duyệt.`,
});
export const useApproveReceipt = () => useApiMutation(receiptApi.approve, {
  success: (r) => `Đã duyệt ${r.receiptCode}; batch và tồn kho đã được cập nhật.`,
});
