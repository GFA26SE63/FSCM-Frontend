/** SPEC §9 – status codes (API, English) ↔ UI labels (Vietnamese, as in the prototype). */
export const statusLabels = {
  order: { Allocating: 'Đang phân bổ', Quoted: 'Chờ Retailer xác nhận báo giá', AllocationFailed: 'Phân bổ lỗi', OutOfStock: 'Thiếu hàng', AllocationConflict: 'Xung đột tồn', Withdrawn: 'Đã hủy', QuoteRejected: 'Báo giá bị từ chối', QuoteExpired: 'Báo giá hết hạn', PaymentPending: 'Chờ thanh toán', ConvertedToPo: 'Đã tạo PO', Picking: 'Đang soạn hàng', Rejected: 'Đã từ chối', Cancelled: 'Đã hủy', Issued: 'Đã xuất kho', Delivering: 'Đang giao', Delivered: 'Đã giao', Completed: 'Hoàn tất' },
  receivable: { AwaitingDelivery: 'Chờ giao', Unpaid: 'Chưa thu', Paid: 'Đã thu đủ', Overdue: 'Quá hạn', Cancelled: 'Đã hủy' },
  product: { Draft: 'Nháp', Published: 'Đã publish', Inactive: 'Inactive' },
  transfer: { Suggested: 'Gợi ý', InTransit: 'Đang vận chuyển', Received: 'Đã nhận', Cancelled: 'Đã hủy' },
  transferKind: { Replenishment: 'Bổ sung', NearExpiryRotation: 'Luân chuyển cận hạn' },
  rotation: { Proposed: 'Đề xuất', Approved: 'Đã duyệt', Skipped: 'Bỏ qua', Expired: 'Hết hạn', DiscountSuggested: 'Gợi ý giảm giá', NoDestination: 'Không có kho đích' },
  gift: { Requested: 'Chờ duyệt', Approved: 'Đã duyệt', Delivered: 'Đang giao quà', Done: 'Hoàn tất', Rejected: 'Bị từ chối' },
  vehicle: { Active: 'Hoạt động', Maintenance: 'Bảo trì' },
  driver: { Active: 'Hoạt động', OnLeave: 'Tạm nghỉ' },
  active: { Active: 'Hoạt động', Inactive: 'Inactive', Locked: 'Đã khóa', Paused: 'Tạm ngừng' },
  promotion: { Scheduled: 'Chưa đến thời gian áp dụng', Running: 'Đang chạy', Paused: 'Tạm dừng', Ended: 'Hết hiệu lực' },
  batchDiscount: { Active: 'Đang áp dụng', Ended: 'Hết hiệu lực' },
  expiry: { Normal: 'Còn hạn', 'Near-date': 'Cận hạn', NearExpiry: 'Cận hạn', Expired: 'Hết hạn', Disposed: 'Đã tiêu hủy' },
  picking: { NotPicked: 'Chưa pick', Picking: 'Đang pick', Shipped: 'Đã xuất' },
  complaint: { Open: 'Chờ xử lý', Approved: 'Đã chấp nhận', Rejected: 'Đã từ chối', Resolved: 'Đã xử lý' },
  registration: { Pending: 'Chờ duyệt', Approved: 'Đã duyệt', Rejected: 'Bị từ chối' },
  receipt: { Posted: 'Đã nhập' },
  disposal: { Disposed: 'Đã tiêu hủy' },
  kpi: { Achieved: 'Đạt', NotAchieved: 'Chưa đạt' },
  channel: { Online: 'Online', Offline: 'Offline' },
  warehouseType: { Central: 'Kho tổng', Regional: 'Kho vùng' },
  loyaltyProgram: { Running: 'Đang chạy', Paused: 'Tạm dừng' },
  inventoryLockReason: {
    Expired: 'Hết hạn sử dụng',
    Damaged: 'Hàng bị hư hỏng',
    QualityHold: 'Chờ kiểm tra chất lượng',
    Recall: 'Thu hồi hàng',
    Other: 'Lý do khác',
  },
} as const;

export type StatusDomain = keyof typeof statusLabels;
export type InventoryLockReason = 'Expired' | 'Damaged' | 'QualityHold' | 'Recall' | 'Other';

export const INVENTORY_LOCK_REASONS = [
  { value: 'Expired', label: 'Hết hạn sử dụng' },
  { value: 'Damaged', label: 'Hàng bị hư hỏng' },
  { value: 'QualityHold', label: 'Chờ kiểm tra chất lượng' },
  { value: 'Recall', label: 'Thu hồi hàng' },
  { value: 'Other', label: 'Lý do khác' },
] as const;

export function formatLockReason(reason?: string | null): string {
  if (!reason) return 'Chưa xác định';
  const map = statusLabels.inventoryLockReason as Record<string, string>;
  return map[reason] ?? reason;
}

export function statusLabel(domain: StatusDomain, code: string): string {
  const map = statusLabels[domain] as Record<string, string>;
  return map[code] ?? code;
}

export const paymentLabel = (method?: string | null, termDays?: number | null): string =>
  method === 'Credit' ? `Công nợ – trả sau ${termDays ?? 0} ngày` : method === 'Prepaid' ? 'Trả trước (chuyển khoản)' : 'Chưa chọn — Retailer chọn khi duyệt báo giá';
