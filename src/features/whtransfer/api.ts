import { get, getAll, post } from '@/shared/api/http';
import type { BatchOption, ReplenishmentSuggestion, Transfer, TransferInput, WarehouseOption } from './types';

export const transferApi = {
  list: () => getAll<Transfer>('/transfers'),
  get: (code: string) => get<Transfer>(`/transfers/${code}`),
  suggestions: () => get<ReplenishmentSuggestion[]>('/transfers/suggestions'),
  create: (input: TransferInput) => post<Transfer>('/transfers', input),
  warehouses: () => getAll<WarehouseOption>('/warehouses'),
  batches: () => getAll<BatchOption>('/batches'),
};
