import { get, getAll, post } from '@/shared/api/http';
import { ApiError } from '@/shared/api/errors';

import type {
  ProductOption,
  Receipt,
  ReceiptDetail,
  ReceiptInput,
  WarehouseOption,
} from './types';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getReceipt(
  idOrCode: string,
): Promise<ReceiptDetail> {
  const value = idOrCode.trim();

  if (!value) {
    throw new ApiError(
      400,
      'Thiếu mã phiếu nhập',
    );
  }

  if (uuidPattern.test(value)) {
    return get<ReceiptDetail>(
      `/goods-receipts/${encodeURIComponent(value)}`,
    );
  }

  const receipts = await get<ReceiptDetail[]>(
    '/goods-receipts',
  );

  const receipt = receipts.find(
    (item) =>
      item.receiptCode.toLowerCase() === value.toLowerCase(),
  );

  if (!receipt) {
    throw new ApiError(
      404,
      'Không tìm thấy phiếu nhập',
      'Phiếu không tồn tại hoặc không thuộc phạm vi được truy cập.',
    );
  }

  return get<ReceiptDetail>(
    `/goods-receipts/${encodeURIComponent(receipt.id)}`,
  );
}

export const receiptApi = {
  // Giữ các hàm đang được màn danh sách/form sử dụng.
  list: () =>
    getAll<Receipt>('/goods-receipts'),

  create: (input: ReceiptInput) =>
    post<Receipt>('/goods-receipts', input),

  warehouses: () =>
    getAll<WarehouseOption>('/warehouses'),

  products: () =>
    getAll<ProductOption>('/products'),

  // Đọc detail theo contract hiện tại của backend.
  get: getReceipt,
};