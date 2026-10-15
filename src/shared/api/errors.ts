import { AxiosError } from 'axios';
import type { ProblemDetails } from './types';

/** Normalised error thrown by every api.ts function (mapped from ProblemDetails). */
export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly code?: string;
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, title: string, detail?: string, code?: string, fieldErrors: Record<string, string[]> = {}) {
    super(detail || title);
    this.name = 'ApiError';
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  /** First message for a field (keys are camelCase, case-insensitive match). */
  field(name: string): string | undefined {
    const key = Object.keys(this.fieldErrors).find((k) => k.toLowerCase() === name.toLowerCase());
    return key ? this.fieldErrors[key][0] : undefined;
  }
}

const defaultTitles: Record<number, string> = {
  0: 'Không kết nối được máy chủ',
  400: 'Dữ liệu không hợp lệ',
  401: 'Phiên đăng nhập đã hết hạn',
  403: 'Bạn không có quyền thực hiện thao tác này',
  404: 'Không tìm thấy dữ liệu',
  409: 'Dữ liệu đã bị thay đổi bởi người khác',
  422: 'Vi phạm quy tắc nghiệp vụ',
  500: 'Lỗi hệ thống',
};

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof AxiosError) {
    const status = err.response?.status ?? 0;
    const body = err.response?.data as ProblemDetails | string | undefined;
    if (body && typeof body === 'object') {
      return new ApiError(status, body.title || defaultTitles[status] || 'Lỗi', body.detail, body.code, body.errors ?? {});
    }
    return new ApiError(status, defaultTitles[status] ?? err.message, typeof body === 'string' ? body : undefined);
  }
  return new ApiError(500, defaultTitles[500], err instanceof Error ? err.message : String(err));
}

export const errorMessage = (err: unknown): string => {
  const e = toApiError(err);
  return e.detail ? `${e.title}: ${e.detail}` : e.title;
};
