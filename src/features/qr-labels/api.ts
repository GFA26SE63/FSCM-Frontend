import { get, http } from '@/shared/api/http';
import { ApiError } from '@/shared/api/errors';

import {
  isPrintableLabel,
  type PrintTarget,
  type QrLabel,
  type QrLabelDetail,
} from './types';

function parsePrintResponse(data: unknown): unknown {
  if (typeof data !== 'string') return data;

  // Giữ nguyên HTML thành công.
  // Parse JSON ProblemDetails để shared interceptor đọc được lỗi BE.
  if (data.trimStart().startsWith('{')) {
    try {
      return JSON.parse(data) as unknown;
    } catch {
      return data;
    }
  }

  return data;
}

async function loadHtml(path: string): Promise<string> {
  const response = await http.get<string>(path, {
    responseType: 'text',
    headers: {
      Accept: 'text/html, application/problem+json',
    },
    transformResponse: [parsePrintResponse],
  });

  const contentType = String(
    response.headers['content-type'] ?? '',
  ).toLowerCase();

  if (
    typeof response.data !== 'string' ||
    !contentType.includes('text/html') ||
    response.data.trim().length === 0
  ) {
    throw new ApiError(
      502,
      'Bản in không hợp lệ',
      'Backend không trả về tài liệu HTML để in tem.',
    );
  }

  return response.data;
}

export const qrLabelApi = {
  listByBatch: (batchId: string): Promise<QrLabel[]> =>
    get<QrLabel[]>('/qr-labels', { batchId }),

  detail: (qrCode: string): Promise<QrLabelDetail> =>
    get<QrLabelDetail>(
      `/qr-labels/${encodeURIComponent(qrCode)}`,
    ),

  printable: async (target: PrintTarget): Promise<string> => {
    if (target.kind === 'batch') {
      return loadHtml(
        `/qr-labels/batches/${encodeURIComponent(target.batchId)}/print`,
      );
    }

    // Kiểm tra lại trạng thái mới nhất trước khi lấy HTML.
    const detail = await qrLabelApi.detail(target.qrCode);

    if (!isPrintableLabel(detail.label)) {
      throw new ApiError(
        409,
        'Không thể in tem',
        'Tem đã bị vô hiệu hóa. Hãy tải lại danh sách tem.',
      );
    }

    return loadHtml(
      `/qr-labels/${encodeURIComponent(target.qrCode)}/print`,
    );
  },
};