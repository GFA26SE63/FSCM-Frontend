import { get, http } from '@/shared/api/http';
import type { InventoryBatch, InventoryLock } from './types';

export const inventoryLockApi = {
  batches: () => get<InventoryBatch[]>('/inventory', { includeExpired: true }),
  list: () => get<InventoryLock[]>('/inventory-locks'),
  create: (v: { batchId: string; quantity: number; reason: string; note: string }) =>
    http.post<InventoryLock>('/inventory-locks', { batchId: v.batchId, quantity: v.quantity, reason: v.reason, note: v.note || null }).then((r) => r.data),
  release: (v: { id: string; expectedVersion: number; note: string }) =>
    http.post<InventoryLock>(`/inventory-locks/${v.id}/release`, { expectedVersion: v.expectedVersion, note: v.note || null }).then((r) => r.data),
};
