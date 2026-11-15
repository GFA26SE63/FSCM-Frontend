import { http, get, getAll, post } from '@/shared/api/http';
import { ApiError } from '@/shared/api/errors';

import type {
  CreateGoodsReceiptRequest,
  ProductOption,
  ReceiptDetail,
  ReceiptListItem,
  WarehouseOption,
} from './types';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function mapReceiptListItem(r: ReceiptDetail): ReceiptListItem {
  const lines = r.lines ?? [];
  return {
    ...r,
    code: r.receiptCode,
    batchCount: lines.length,
    totalQty: lines.reduce((sum, l) => sum + (l.receivedQuantity || 0), 0),
  };
}

async function getReceipt(idOrCode: string): Promise<ReceiptDetail> {
  const value = idOrCode.trim();

  if (!value) {
    throw new ApiError(400, 'Thiếu mã phiếu nhập');
  }

  if (uuidPattern.test(value)) {
    return get<ReceiptDetail>(`/goods-receipts/${encodeURIComponent(value)}`);
  }

  const receipts = await getAll<ReceiptDetail>('/goods-receipts');

  const receipt = receipts.find(
    (item) => item.receiptCode?.toLowerCase() === value.toLowerCase(),
  );

  if (!receipt) {
    throw new ApiError(
      404,
      'Không tìm thấy phiếu nhập',
      'Phiếu không tồn tại hoặc không thuộc phạm vi được truy cập.',
    );
  }

  return get<ReceiptDetail>(`/goods-receipts/${encodeURIComponent(receipt.id)}`);
}

interface RawWarehouseResult {
  id?: string;
  code?: string;
  name?: string;
  isActive?: boolean;
  status?: string;
  keepers?: { userId?: string; fullName?: string; email?: string }[];
}

export function normalizeWarehouseOption(raw: RawWarehouseResult): WarehouseOption {
  const active = raw.isActive ?? (raw.status !== 'Paused' && raw.status !== 'Inactive');
  return {
    id: String(raw.id || ''),
    code: String(raw.code || ''),
    name: String(raw.name || ''),
    isActive: Boolean(active),
    status: active ? 'Active' : 'Paused',
    keepers: Array.isArray(raw.keepers)
      ? raw.keepers.map((k) => ({
          userId: String(k.userId || ''),
          fullName: String(k.fullName || ''),
          email: String(k.email || ''),
        }))
      : [],
  };
}

export const receiptApi = {
  list: async (warehouseId?: string): Promise<ReceiptListItem[]> => {
    const raw = await getAll<ReceiptDetail>('/goods-receipts', warehouseId ? { warehouseId } : undefined);
    return raw.map(mapReceiptListItem);
  },

  get: getReceipt,

  create: async (payload: CreateGoodsReceiptRequest): Promise<ReceiptDetail> => {
    const res = await http.post<ReceiptDetail>('/goods-receipts', payload, {
      headers: {
        'Idempotency-Key': generateIdempotencyKey(),
      },
    });
    return res.data;
  },

  approve: async (receiptId: string): Promise<ReceiptDetail> => {
    return post<ReceiptDetail>(`/goods-receipts/${encodeURIComponent(receiptId)}/approve`);
  },

  warehouses: async (): Promise<WarehouseOption[]> => {
    const raw = await getAll<RawWarehouseResult>('/warehouses');
    return raw.map(normalizeWarehouseOption);
  },

  products: () => getAll<ProductOption>('/products'),
};
