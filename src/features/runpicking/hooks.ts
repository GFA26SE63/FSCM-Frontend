import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { pickingApi } from './api';
import { fetchPickingListPage, type PickingPageQuery } from './pickingGraphql';

export const usePickingLists = (warehouseId?: string, status?: string) =>
  useQuery({
    queryKey: ['picking-lists', warehouseId ?? '', status ?? ''],
    queryFn: () => pickingApi.lists(warehouseId, status),
  });

export const useWarehouseOptions = () =>
  useQuery({ queryKey: ['picking-lists', 'warehouses'], queryFn: pickingApi.warehouses });

/** Một trang phiếu soạn hàng (GraphQL, phân trang phía server). */
export const usePickingListPage = (query: PickingPageQuery, enabled = true) =>
  useQuery({
    queryKey: ['picking-lists', 'page', query],
    queryFn: () => fetchPickingListPage(query),
    placeholderData: keepPreviousData,
    retry: false,
    enabled,
  });
