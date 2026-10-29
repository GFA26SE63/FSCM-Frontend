import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { pickingApi } from './api';

export const usePickingLists = () =>
  useQuery({
    queryKey: ['picking', 'list'],
    queryFn: pickingApi.list,
  });

export const usePickingList = (code: string) =>
  useQuery({
    queryKey: ['picking', 'detail', code],
    queryFn: () => pickingApi.get(code),
  });

export const useScanPicking = () =>
  useApiMutation(pickingApi.scan, {
    permission: 'picking.scan',
    success: (picking) =>
      `Đã quét tem – ${picking.code} chuyển sang Đang pick.`,
  });

export const useShipPicking = () =>
  useApiMutation(pickingApi.ship, {
    permission: 'picking.complete',
    success: (result) =>
      result.remainingLists > 0
        ? `Đã xuất ${result.picking.code}; đơn ${result.picking.orderCode} còn ${result.remainingLists} picking list.`
        : `Đã xuất đủ các kho – đơn ${result.picking.orderCode} chuyển Đã xuất kho.`,
  });