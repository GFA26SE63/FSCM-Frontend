import { ApiError } from '@/shared/api/errors';
import type { LoyaltyProgram, ProgramInput } from './types';

export interface ProgramFormValues {
  name: string;
  description: string;
  spendAmountPerPoint: number | string;
  minimumRedeemPoints: number | string;
  startAt: string;
  endAt: string;
  pointsExpireAt: string;
  retailerIds: string[];
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** datetime-local represents Vietnam time, never the browser's device timezone. */
export function toVietnamInput(instant: string): string {
  return new Date(Date.parse(instant) + 7 * 3600000).toISOString().slice(0, 23);
}

export function vietnamInputToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(value)) {
    throw new Error('Nhập ngày và giờ hợp lệ.');
  }
  const instant = new Date(`${value}+07:00`);
  if (!Number.isFinite(instant.getTime()) ||
      toVietnamInput(instant.toISOString()).slice(0, value.length) !== value) {
    throw new Error('Nhập ngày và giờ hợp lệ.');
  }
  return instant.toISOString();
}

export function programInitial(program?: LoyaltyProgram): ProgramFormValues {
  return {
    name: program?.name ?? '',
    description: program?.description ?? '',
    spendAmountPerPoint: program?.spendAmountPerPoint ?? '',
    minimumRedeemPoints: program?.minimumRedeemPoints ?? 0,
    startAt: program ? toVietnamInput(program.startAt) : '',
    endAt: program ? toVietnamInput(program.endAt) : '',
    pointsExpireAt: program?.pointsExpireAt ? toVietnamInput(program.pointsExpireAt) : '',
    retailerIds: program ? [...program.retailerIds] : [],
  };
}

export function validateProgram(values: ProgramFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const nameLength = values.name.trim().length;
  if (nameLength < 3 || nameLength > 200) errors.name = 'Tên phải có từ 3 đến 200 ký tự.';
  const rate = Number(String(values.spendAmountPerPoint).replace(',', '.'));
  if (String(values.spendAmountPerPoint).trim() === '' || !Number.isFinite(rate) || rate <= 0) {
    errors.spendAmountPerPoint = 'Số tiền cho 1 điểm phải lớn hơn 0.';
  }
  const minimum = Number(String(values.minimumRedeemPoints).replace(',', '.'));
  if (String(values.minimumRedeemPoints).trim() === '' ||
      !Number.isInteger(minimum) || minimum < 0 || minimum > 2147483647) {
    errors.minimumRedeemPoints = 'Nhập số điểm nguyên không âm hợp lệ.';
  }
  for (const key of ['startAt', 'endAt', 'pointsExpireAt'] as const) {
    if (key === 'pointsExpireAt' && !values[key]) continue;
    try { vietnamInputToIso(values[key]); }
    catch { errors[key] = 'Nhập ngày và giờ hợp lệ.'; }
  }
  if (!errors.startAt && !errors.endAt &&
      Date.parse(vietnamInputToIso(values.endAt)) <= Date.parse(vietnamInputToIso(values.startAt))) {
    errors.endAt = 'Thời điểm kết thúc phải sau thời điểm bắt đầu.';
  }
  if (values.pointsExpireAt && !errors.pointsExpireAt && !errors.endAt &&
      Date.parse(vietnamInputToIso(values.pointsExpireAt)) < Date.parse(vietnamInputToIso(values.endAt))) {
    errors.pointsExpireAt = 'Hạn điểm phải bằng hoặc sau thời điểm kết thúc chương trình.';
  }
  if (!Array.isArray(values.retailerIds) || values.retailerIds.length === 0 ||
      values.retailerIds.some((id) => !uuid.test(id))) {
    errors.retailerIds = 'Chọn ít nhất một retailer có ID hợp lệ.';
  }
  return errors;
}

export function programPayload(values: ProgramFormValues, original?: LoyaltyProgram): ProgramInput {
  const errors = validateProgram(values);
  if (Object.keys(errors).length) {
    throw new ApiError(400, 'Dữ liệu chương trình chưa hợp lệ.', undefined, undefined,
        Object.fromEntries(Object.entries(errors).map(([key, message]) => [key, [message]])));
  }
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    spendAmountPerPoint: Number(String(values.spendAmountPerPoint).replace(',', '.')),
    minimumRedeemPoints: Number(String(values.minimumRedeemPoints).replace(',', '.')),
    startAt: original && values.startAt === toVietnamInput(original.startAt)
      ? original.startAt : vietnamInputToIso(values.startAt),
    endAt: original && values.endAt === toVietnamInput(original.endAt)
      ? original.endAt : vietnamInputToIso(values.endAt),
    pointsExpireAt: values.pointsExpireAt
      ? original?.pointsExpireAt && values.pointsExpireAt === toVietnamInput(original.pointsExpireAt)
        ? original.pointsExpireAt : vietnamInputToIso(values.pointsExpireAt)
      : null,
    retailerIds: [...new Set(values.retailerIds)],
  };
}

export function programStatus(program: LoyaltyProgram, now: number): string {
  if (Date.parse(program.endAt) < now) return 'Đã hết hạn';
  if (!program.isActive) return 'Chưa kích hoạt / tạm dừng';
  return Date.parse(program.startAt) > now ? 'Đã bật · chờ hiệu lực' : 'Đang hiệu lực';
}
