import {
  ApiError,
  toApiError,
} from '@/shared/api/errors';

export const numberValue = (value: unknown) =>
  Number(
    String(value).trim().replace(',', '.'),
  );

export function dayError(
  value: unknown,
  allowZero = false,
) {
  const hours = numberValue(value) * 24;
  const rounded = Math.round(hours);

  if (
    !Number.isFinite(hours) ||
    hours < 0 ||
    (!allowZero && hours === 0)
  ) {
    return allowZero
      ? 'Số ngày phải không âm.'
      : 'Số ngày phải lớn hơn 0.';
  }

  if (
    Math.abs(hours - rounded) > 0.000001 ||
    rounded > 2_147_483_647
  ) {
    return 'Số ngày phải quy đổi thành số giờ nguyên hợp lệ.';
  }

  if (!allowZero && rounded === 0) {
    return 'Hạn dùng tối thiểu là 1 giờ.';
  }

  return undefined;
}

export function daysToHours(
  value: unknown,
): number {
  const error = dayError(value, true);

  if (error) {
    throw new ApiError(
      400,
      'Hạn dùng không hợp lệ',
      error,
    );
  }

  return Math.round(numberValue(value) * 24);
}

export function priceError(value: unknown) {
  const price = numberValue(value);

  if (!Number.isFinite(price) || price <= 0) {
    return 'Giá phải lớn hơn 0.';
  }

  if (price > Number.MAX_SAFE_INTEGER / 100) {
    return 'Giá vượt giới hạn xử lý của giao diện.';
  }

  if (
    Math.abs(
      price * 100 - Math.round(price * 100),
    ) > 0.000001
  ) {
    return 'Giá có tối đa 2 chữ số thập phân.';
  }

  return undefined;
}

export function skuError(value: unknown) {
  return /^SKU[0-9]{3}$/.test(
    String(value).trim().toUpperCase(),
  )
    ? undefined
    : 'SKU phải có dạng SKU001.';
}

export function lifeText(hours: number) {
  return hours % 24 === 0
    ? hours / 24 + ' ngày'
    : Math.floor(hours / 24) +
        ' ngày ' +
        hours % 24 +
        ' giờ';
}

export function priceText(
  price: number | null,
) {
  return price == null
    ? 'Chưa có giá'
    : price.toLocaleString('vi-VN', {
        maximumFractionDigits: 2,
      }) + 'đ';
}

export function productFormError(
  error: unknown,
) {
  const apiError = toApiError(error);

  const aliases: Record<string, string> = {
    shelflifehours: 'shelfLifeDays',
    neardatethresholdhours: 'nearDateDays',
  };

  const fields: Record<string, string[]> = {};

  for (
    const [key, messages]
    of Object.entries(apiError.fieldErrors)
  ) {
    const field = key.split('.').pop() ?? key;

    fields[
      aliases[field.toLowerCase()] ?? field
    ] = messages;
  }

  return new ApiError(
    apiError.status,
    apiError.title,
    apiError.detail,
    apiError.code,
    fields,
  );
}