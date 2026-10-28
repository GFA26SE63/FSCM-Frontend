import { get } from '@/shared/api/http';
import type { AllocationRunHeader, RunPickingList, WarehouseOption } from './types';

export const runPickingApi = {
  /** One run per Vietnam business date; the date is what an Operator has in hand. */
  runByDate: (businessDate: string) => get<AllocationRunHeader>(`/allocation-runs/by-date/${businessDate}`),
  listsForRun: (runId: string) => get<RunPickingList[]>(`/allocation-runs/${runId}/picking-lists`),
  /** Plain array on this endpoint, so `get`, not `getAll`. */
  warehouses: () => get<WarehouseOption[]>('/warehouses'),
};
