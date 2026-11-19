import { AxiosError } from 'axios';
import type { ProblemDetails } from './types';

// Exact messages verified against BE develop. Unknown business messages are kept
// intact: replacing all validation/conflict errors with a generic sentence loses
// the reason the operation was refused. Keep this list explicit and reviewable.
const vietnameseMessages: Record<string, string> = {
  'Bad Request': 'Yêu cầu không hợp lệ',
  Unauthorized: 'Chưa xác thực',
  Forbidden: 'Không có quyền thực hiện',
  'Not Found': 'Không tìm thấy dữ liệu',
  Conflict: 'Xung đột dữ liệu',
  'Internal Server Error': 'Lỗi máy chủ',
  'One or more validation errors occurred.': 'Có thông tin chưa hợp lệ.',
  'An error occurred while processing your request.': 'Đã xảy ra lỗi khi xử lý yêu cầu.',
  'The email address, phone number, or password is invalid.': 'Email, số điện thoại hoặc mật khẩu không đúng.',
  'The account is temporarily locked. Try again later.': 'Tài khoản đang tạm khóa. Vui lòng thử lại sau.',
  'The token is invalid or has expired.': 'Mã xác thực không hợp lệ hoặc đã hết hạn.',
  'Loyalty program was not found.': 'Không tìm thấy chương trình tích điểm.',
  'Loyalty reward was not found.': 'Không tìm thấy quà đổi điểm.',
  'Active loyalty reward was not found.': 'Không tìm thấy quà đang hoạt động trong chương trình áp dụng.',
  'Reward name must contain between 2 and 200 characters.': 'Tên quà phải có từ 2 đến 200 ký tự.',
  'Reward type is required.': 'Vui lòng chọn loại quà.',
  'Required points must be greater than zero.': 'Điểm đổi quà phải lớn hơn 0.',
  'Discount values are invalid.': 'Thông tin giảm giá không hợp lệ.',
  'Available quantity cannot be negative.': 'Số lượng quà còn có thể cấp không được âm.',
  'An out-of-stock reward cannot be activated.': 'Không thể kích hoạt quà đã hết số lượng.',
  'Quantity must be greater than zero.': 'Số lượng phải lớn hơn 0.',
  'Client request id is required and must be at most 100 characters.': 'Mã yêu cầu bắt buộc có và không được quá 100 ký tự.',
  'The account is not linked to an active retailer.': 'Tài khoản chưa liên kết với nhà bán lẻ đang hoạt động.',
  'The account is not linked to a retailer.': 'Tài khoản chưa liên kết với nhà bán lẻ.',
  'No active loyalty program applies to this retailer.': 'Chưa có chương trình tích điểm đang hoạt động áp dụng cho nhà bán lẻ này.',
  'The requested reward quantity is not available.': 'Không đủ số lượng quà để đáp ứng yêu cầu.',
  'Insufficient available loyalty points.': 'Không đủ điểm khả dụng để đổi quà.',
  'This redemption request was already submitted.': 'Yêu cầu đổi quà này đã được gửi trước đó.',
  'The reward inventory changed concurrently. Retry the request.': 'Số lượng quà vừa thay đổi. Vui lòng thử lại yêu cầu.',
  'Redemption request was not found.': 'Không tìm thấy yêu cầu đổi quà.',
  'Retailer loyalty balance was not found.': 'Không tìm thấy số dư tích điểm của nhà bán lẻ.',
  'Held loyalty points are inconsistent.': 'Số điểm đang giữ không khớp. Cần đối soát trước khi tiếp tục.',
  'Image storage is not configured on the server.': 'Máy chủ chưa được cấu hình dịch vụ lưu ảnh.',
  'Image storage is unavailable.': 'Dịch vụ lưu ảnh hiện không khả dụng.',
  'Page must be at least 1.': 'Số trang phải từ 1 trở lên.',
  'Page size must be between 1 and 100.': 'Số bản ghi mỗi trang phải từ 1 đến 100.',
  'Notification type cannot exceed 50 characters.': 'Loại thông báo không được quá 50 ký tự.',
  'Notification identifier is required.': 'Thiếu mã thông báo.',
  'Retailer was not found.': 'Không tìm thấy nhà bán lẻ.',
  'Only an active Retailer can be inactivated.': 'Chỉ nhà bán lẻ đang hoạt động mới chuyển được sang ngừng hoạt động.',
  'Only an inactive Retailer can be reactivated.': 'Chỉ nhà bán lẻ đang ngừng hoạt động mới kích hoạt lại được.',
  'A Retailer declaration requires at least one valid Category or SKU MLOR entry before review or activation.':
    'Nhà bán lẻ cần ít nhất một yêu cầu HSD tối thiểu hợp lệ (theo danh mục hoặc SKU) trước khi duyệt hoặc kích hoạt.',
};

export const localizeApiMessage = (message: string): string => vietnameseMessages[message] ?? message;

/** Normalised error thrown by every api.ts function (mapped from ProblemDetails). */
export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly code?: string;
  readonly fieldErrors: Record<string, string[]>;
  readonly originalTitle: string;
  readonly originalDetail?: string;

  constructor(status: number, title: string, detail?: string, code?: string, fieldErrors: Record<string, string[]> = {}) {
    const translatedTitle = localizeApiMessage(title);
    const translatedDetail = detail ? localizeApiMessage(detail) : detail;
    super(translatedDetail || translatedTitle);
    this.name = 'ApiError';
    this.status = status;
    this.title = translatedTitle;
    this.detail = translatedDetail;
    this.code = code;
    this.fieldErrors = Object.fromEntries(Object.entries(fieldErrors).map(([key, messages]) =>
      [key, messages.map(localizeApiMessage)]));
    this.originalTitle = title;
    this.originalDetail = detail;
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
  403: 'Bạn chưa được cấp quyền thực hiện thao tác này',
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
  const context = [
    Number.isFinite(e.status) && e.status > 0 ? `HTTP ${e.status}` : null,
    e.code ? `Mã: ${e.code}` : null,
  ].filter((value): value is string => value !== null);
  const heading = context.length ? `${e.title} (${context.join(' · ')})` : e.title;
  const details = e.detail ? [heading, e.detail] : [heading];
  const fields = Object.entries(e.fieldErrors)
    .flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`));

  return [...details, ...fields].join('\n');
};
