import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { debtApi } from './api';

export const useReceivables = () => useQuery({ queryKey: ['debts', 'list'], queryFn: debtApi.list });
export const useCollectReceivable = () =>
  useApiMutation(debtApi.collect, { success: (r) => `Đã ghi nhận thu đủ ${r.receivable.orderCode}; cộng ${r.pointsEarned} điểm loyalty cho ${r.receivable.retailerName}.` });
