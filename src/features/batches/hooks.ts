import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { batchApi } from './api';
import type {
  BatchFilters,
  CreateInventoryLockInput,
  ReleaseInventoryLockInput,
} from './types';

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
      permission: 'inventory.lock',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['batches'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-locks'] });
      },
    },
  );
};
