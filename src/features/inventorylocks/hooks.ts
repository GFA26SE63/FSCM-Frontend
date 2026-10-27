import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { inventoryLockApi } from './api';

export const useInventoryBatches = () => useQuery({ queryKey: ['inventory', 'batches', 'for-locks'], queryFn: inventoryLockApi.batches });
export const useInventoryLocks = () => useQuery({ queryKey: ['inventory-locks', 'list'], queryFn: inventoryLockApi.list });
export const useCreateInventoryLock = () => useApiMutation(inventoryLockApi.create, { success: 'Đã khóa lượng hàng khỏi khả dụng.' });
export const useReleaseInventoryLock = () => useApiMutation(inventoryLockApi.release, { success: 'Đã mở khóa lượng hàng.' });
