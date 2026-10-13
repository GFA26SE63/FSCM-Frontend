import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { pickingApi } from './api';

export const usePickingLists = () => useQuery({ queryKey: ['picking', 'list'], queryFn: pickingApi.list });
export const usePickingList = (code: string) => useQuery({ queryKey: ['picking', 'detail', code], queryFn: () => pickingApi.get(code) });
export const useScanPicking = () => useApiMutation(pickingApi.scan, { success: (p) => `Đã quét tem – ${p.code} chuyển sang Đang pick.` });
export const useShipPicking = () =>
  useApiMutation(pickingApi.ship, {
    success: (r) => (r.remainingLists > 0 ? `Đã xuất ${r.picking.code}; đơn ${r.picking.orderCode} còn ${r.remainingLists} picking list.` : `Đã xuất đủ các kho – đơn ${r.picking.orderCode} chuyển Đã xuất kho.`),
  });
