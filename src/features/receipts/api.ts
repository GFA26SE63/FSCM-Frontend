import { get, http, post } from '@/shared/api/http';
import type { ProductOption, Receipt, ReceiptInput, WarehouseOption } from './types';

export const receiptApi = {
  list: () => get<Receipt[]>('/goods-receipts'),
  get: (id: string) => get<Receipt>(`/goods-receipts/${id}`),
  create: ({ operationKey, ...input }: ReceiptInput) =>
    http.post<Receipt>('/goods-receipts', input, { headers: { 'Idempotency-Key': operationKey } })
      .then((response) => response.data),
  approve: (id: string) => post<Receipt>(`/goods-receipts/${id}/approve`),
  /** Warehouse Keeper selects labels; backend IDs are submitted without typing SKU/GUID. */
  warehouses: () => get<WarehouseOption[]>('/warehouses'),
  products: () => get<{ items: ProductOption[] }>('/products', { status: 'Published', page: 1, pageSize: 100 })
    .then((page) => page.items),
};
