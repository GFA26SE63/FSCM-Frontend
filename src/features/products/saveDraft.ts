import { ApiError, toApiError } from '@/shared/api/errors';
import { productApi } from './api';
import type { Product, ProductFields } from './types';

export async function saveProductDraft({ id, unitPrice, ...fields }: ProductFields & {
  id: string; unitPrice: number;
}): Promise<Product> {
  let current = await productApi.get(id);
  if (current.status !== 'Draft') {
    throw new ApiError(409, 'Sản phẩm đã khóa', 'Sản phẩm không còn là bản nháp. Hãy tải lại thông tin.');
  }
  let infoSaved = false;
  try {
    if (Object.entries(fields).some(([key, value]) => current[key as keyof ProductFields] !== value)) {
      current = await productApi.update({ id, ...fields });
      infoSaved = true;
    }
    if (current.currentUnitPrice !== unitPrice) {
      await productApi.setPrice({ id, unitPrice });
    }
    return { ...current, currentUnitPrice: unitPrice };
  } catch (failure) {
    const error = toApiError(failure);
    if (!infoSaved) throw error;
    throw new ApiError(error.status, 'Chưa lưu xong giá',
      'Thông tin sản phẩm đã lưu, nhưng chưa cập nhật được giá. Kiểm tra và lưu lại. ' +
      (error.detail ?? error.title), error.code, error.fieldErrors);
  }
}
