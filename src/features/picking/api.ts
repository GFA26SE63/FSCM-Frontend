import { get, getAll, post } from '@/shared/api/http';
import type { PickingList, ShipResult } from './types';

export const pickingApi = {
  list: () => getAll<PickingList>('/picking-lists'),
  get: (code: string) => get<PickingList>(`/picking-lists/${code}`),
  /** Warehouse Keeper starts picking by scanning batch labels. */
  scan: (code: string) => post<PickingList>(`/picking-lists/${code}/scan`, { labelCode: 'portal-demo' }),
  ship: (code: string) => post<ShipResult>(`/picking-lists/${code}/ship`),
};
