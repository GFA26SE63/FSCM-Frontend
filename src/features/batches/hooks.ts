import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { batchApi } from './api';
import {
  fetchBatchesPage,
  fetchInventoryBalances,
  fetchProductCatalog,
  type BatchesPageQuery,
} from './batchesGraphql';
import type {
  BatchFilters,
  CreateInventoryLockInput,
  ReleaseInventoryLockInput,
} from './types';

/** Server-side cursor-paginated batches via GraphQL entities.batches. */
export const useBatchesPage = (q: BatchesPageQuery) =>
  useQuery({
    queryKey: ['batches', 'page', q],
    queryFn: () => fetchBatchesPage(q),
    placeholderData: (prev) => prev,
    retry: false,
    staleTime: 15_000,
  });

/**
 * Batch-fetch on-hand/reserved/available quantities for the given batch IDs via
 * entities.inventoryBalances. Returns Map<batchId, BatchBalance>. Never throws.
 */
export const useInventoryBalancesForPage = (batchIds: string[]) => {
  const sortedIds = [...batchIds].sort();
  return useQuery({
    queryKey: ['batches', 'balances', sortedIds],
    queryFn: () => fetchInventoryBalances(sortedIds),
    enabled: sortedIds.length > 0,
    staleTime: 15_000,
    retry: false,
  });
};

/**
 * Product catalog (id/sku/name) via entities.products — shared master data, fetched
 * once. Backs the SKU filter dropdown, row enrichment, and search-term resolution.
 */
export const useProductCatalogForBatches = () =>
  useQuery({
    queryKey: ['batches', 'productCatalog'],
    queryFn: fetchProductCatalog,
    staleTime: 60_000,
    retry: false,
  });

export const useBatches = (filters?: BatchFilters) =>
  useQuery({
    queryKey: ['batches', 'list', filters],
    queryFn: () => batchApi.list(filters),
  });

export const useBatch = (batchIdOrCode: string) =>
  useQuery({
    queryKey: ['batches', 'detail', batchIdOrCode],
    queryFn: () => batchApi.get(batchIdOrCode),
    enabled: !!batchIdOrCode,
  });

export const useBatchHistory = (batchId?: string, warehouseId?: string) =>
  useQuery({
    queryKey: ['batches', 'history', batchId, warehouseId],
    queryFn: () => batchApi.getHistory(batchId, warehouseId),
    enabled: !!batchId || !!warehouseId,
  });

export const useBatchLocks = (params?: {
  batchId?: string;
  warehouseId?: string;
  status?: string;
}) =>
  useQuery({
    queryKey: ['inventory-locks', 'list', params],
    queryFn: () => batchApi.getLocks(params),
  });

export const useCreateInventoryLock = () => {
  const queryClient = useQueryClient();
  return useApiMutation(
    (input: CreateInventoryLockInput) => batchApi.createLock(input),
    {
      permission: 'inventory.lock',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['batches'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-locks'] });
      },
    },
  );
};

export const useReleaseInventoryLock = () => {
  const queryClient = useQueryClient();
  return useApiMutation(
    ({
      lockId,
      input,
    }: {
      lockId: string;
      input: ReleaseInventoryLockInput;
    }) => batchApi.releaseLock(lockId, input),
    {
      permission: 'inventory.unlock',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['batches'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-locks'] });
      },
    },
  );
};
