export const SORT_OPTIONS = ['newest', 'oldest'] as const;
export type RetailerSort = (typeof SORT_OPTIONS)[number];

export const SORT_SELECT_OPTIONS = [
  { label: 'Mới nhất', value: 'newest' },
  { label: 'Cũ nhất', value: 'oldest' },
];

/**
 * Sắp xếp danh sách Retailer theo thời gian tạo (createdAt).
 * - 'newest' (mặc định): createdAt giảm dần (DESC).
 * - 'oldest': createdAt tăng dần (ASC).
 *
 * Nguyên tắc nghiệp vụ:
 * 1. Sắp xếp dựa trên thời gian tạo thực tế (createdAt), tuyệt đối không dùng updatedAt.
 * 2. Cơ chế phân định ổn định (tie-breaker): so sánh code, sau đó đến id.
 * 3. Xử lý an toàn khi thiếu createdAt hoặc định dạng ngày không hợp lệ.
 */
export function sortRetailers<T extends { createdAt?: string; code?: string; id?: string }>(
  list: T[],
  sort: RetailerSort = 'newest',
): T[] {
  return [...list].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    const validA = Number.isFinite(timeA) ? timeA : 0;
    const validB = Number.isFinite(timeB) ? timeB : 0;

    if (sort === 'oldest') {
      const diff = validA - validB;
      if (diff !== 0) return diff;
      return (a.code || '').localeCompare(b.code || '') || (a.id || '').localeCompare(b.id || '');
    }

    // Mặc định 'newest' (thời gian tạo giảm dần DESC)
    const diff = validB - validA;
    if (diff !== 0) return diff;
    return (b.code || '').localeCompare(a.code || '') || (b.id || '').localeCompare(a.id || '');
  });
}

