import { get, getAll, post } from '@/shared/api/http';
import type { ProductOption, Receipt, ReceiptInput, WarehouseOption } from './types';

export const receiptApi = {
  list: () => getAll<Receipt>('/goods-receipts'),
  get: (code: string) => get<Receipt>(`/goods-receipts/${code}`),
  create: (input: ReceiptInput) => post<Receipt>('/goods-receipts', input),
  /** Lookups for the form (own calls – features never import each other). */
  warehouses: () => getAll<WarehouseOption>('/warehouses'),
  products: () => getAll<ProductOption>('/products'),
};
