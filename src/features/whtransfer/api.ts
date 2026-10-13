import { get, getAll, post } from '@/shared/api/http';
import type { BatchOption, ReplenishmentSuggestion, Transfer, TransferInput, WarehouseOption } from './types';

export const transferApi = {
  list: () => getAll<Transfer>('/transfers'),
  get: (code: string) => get<Transfer>(`/transfers/${code}`),
  suggestions: () => get<ReplenishmentSuggestion[]>('/transfers/suggestions'),
  create: (input: TransferInput) => post<Transfer>('/transfers', input),
  receive: (code: string) => post<Transfer>(`/transfers/${code}/receive`, { labelCode: 'portal-demo' }),
  warehouses: () => getAll<WarehouseOption>('/warehouses'),
  batches: () => getAll<BatchOption>('/batches'),
};
