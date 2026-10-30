import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { transferApi } from './api';

export const useTransfers = () => useQuery({ queryKey: ['transfers', 'list'], queryFn: transferApi.list });
export const useTransfer = (code: string) => useQuery({ queryKey: ['transfers', 'detail', code], queryFn: () => transferApi.get(code) });
export const useReplenishmentSuggestions = () => useQuery({ queryKey: ['transfers', 'suggestions'], queryFn: transferApi.suggestions });
export const useTransferLookups = (enabled: boolean) => ({
  warehouses: useQuery({ queryKey: ['transfers', 'warehouses'], queryFn: transferApi.warehouses, enabled }),
  batches: useQuery({ queryKey: ['transfers', 'batches'], queryFn: transferApi.batches, enabled }),
});
export const useCreateTransfer = () => useApiMutation(transferApi.create, { success: (t) => `Đã tạo phiếu điều chuyển ${t.code} – Đang vận chuyển.` });
