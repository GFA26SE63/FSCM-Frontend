import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { debtApi } from './api';

export const useReceivables = () =>
  useQuery({
    queryKey: ['debts', 'list'],
    queryFn: debtApi.list,
  });

export const useCollectReceivable = () =>
  useApiMutation(debtApi.collect, {
    permission: 'payments.collect',
    success: (result) =>
      `Đã ghi nhận thu đủ công nợ đơn ${result.orderCode}.`,
  });