/** SPEC §9 – status codes (API, English) ↔ UI labels (Vietnamese, as in the prototype). */
export const statusLabels = {
  order: { Allocating: 'Đang phân bổ', Quoted: 'Chờ điểm bán xác nhận báo giá', AllocationFailed: 'Phân bổ lỗi', OutOfStock: 'Thiếu hàng', AllocationConflict: 'Xung đột tồn', Withdrawn: 'Đã hủy', QuoteRejected: 'Báo giá bị từ chối', QuoteExpired: 'Báo giá hết hạn', PaymentPending: 'Chờ thanh toán', ConvertedToPo: 'Đã phát hành đơn thực hiện', Picking: 'Đang soạn hàng', Rejected: 'Đã từ chối', Cancelled: 'Đã hủy', Issued: 'Đã xuất kho', Delivering: 'Đang giao', Delivered: 'Đã giao', Completed: 'Hoàn tất' },
  receivable: { AwaitingDelivery: 'Chờ giao', Unpaid: 'Chưa thu', PartiallyPaid: 'Đã thu một phần', Paid: 'Đã thu đủ', Overdue: 'Quá hạn', Cancelled: 'Đã hủy' },
  product: { Draft: 'Nháp', Published: 'Đang bán', Inactive: 'Ngừng bán' },
  transfer: { Suggested: 'Gợi ý', InTransit: 'Đang vận chuyển', Received: 'Đã nhận', Cancelled: 'Đã hủy' },
  transferKind: { Replenishment: 'Bổ sung', NearExpiryRotation: 'Luân chuyển cận hạn' },
  rotation: { Proposed: 'Đề xuất', Approved: 'Đã duyệt', Skipped: 'Bỏ qua', Expired: 'Hết hạn', DiscountSuggested: 'Gợi ý giảm giá', NoDestination: 'Không có kho đích' },
  gift: { Requested: 'Chờ duyệt', Pending: 'Chờ duyệt', Approved: 'Đã duyệt', Delivered: 'Đang giao quà', Done: 'Hoàn tất', Completed: 'Hoàn tất', Rejected: 'Bị từ chối' },
  vehicle: { Active: 'Hoạt động', Maintenance: 'Bảo trì' },
  driver: { Active: 'Hoạt động', OnLeave: 'Tạm nghỉ' },
  active: { Active: 'Hoạt động', Inactive: 'Ngừng hoạt động', Locked: 'Đã khóa', Paused: 'Tạm ngừng' },
  promotion: { Scheduled: 'Chưa đến thời gian áp dụng', Running: 'Đang chạy', Paused: 'Tạm dừng', Ended: 'Hết hiệu lực' },
  batchDiscount: { Active: 'Đang áp dụng', Ended: 'Hết hiệu lực' },
  expiry: { Normal: 'Còn hạn', 'Near-date': 'Cận hạn', NearExpiry: 'Cận hạn', Expired: 'Hết hạn', Disposed: 'Đã tiêu hủy' },
  picking: { NotPicked: 'Chưa soạn hàng', Picking: 'Đang soạn hàng', Shipped: 'Đã xuất' },
  pickingLine: { Pending: 'Chưa soạn', InProgress: 'Đang soạn', Completed: 'Đã soạn xong', Cancelled: 'Đã hủy' },
  complaint: { Open: 'Chờ xử lý', Submitted: 'Chờ xử lý', UnderReview: 'Cần bổ sung / đang xem xét', Approved: 'Đã chấp nhận', Rejected: 'Đã từ chối', Resolved: 'Đã xử lý', Cancelled: 'Điểm bán đã hủy' },
  registration: { Pending: 'Chờ duyệt', Approved: 'Đã duyệt', Rejected: 'Bị từ chối' },
  receipt: { Pending: 'Chờ duyệt', Received: 'Đã nhập kho', Posted: 'Đã nhập kho' },
  disposal: { Disposed: 'Đã tiêu hủy' },
  kpi: { Achieved: 'Đạt', NotAchieved: 'Chưa đạt' },
  channel: { Online: 'Trực tuyến', Offline: 'Ngoại tuyến' },
  warehouseType: { Central: 'Kho tổng', Regional: 'Kho vùng' },
  loyaltyProgram: { Running: 'Đang chạy', Paused: 'Tạm dừng' },
  expirySweep: { Running: 'Đang xử lý', Completed: 'Đã hoàn tất kiểm tra', Failed: 'Kiểm tra thất bại' },
  allocation: { Allocating: 'Đang phân bổ', Processing: 'Đang xử lý', Succeeded: 'Thành công',
    OutOfStock: 'Thiếu hàng', Conflict: 'Xung đột tồn kho', TechnicalFailed: 'Lỗi xử lý',
    Allocated: 'Đã phân bổ', Failed: 'Phân bổ thất bại', NotApplicable: 'Không áp dụng',
    Short: 'Thiếu hàng', Released: 'Đã trả lại tồn giữ chỗ' },
  shipment: { WaitingToPick: 'Chờ soạn hàng', Ready: 'Sẵn sàng xuất', Issued: 'Đã xuất kho',
    Delivering: 'Đang giao', Received: 'Đã nhận hàng', Exception: 'Có phát sinh cần xử lý' },
  qrEvent: { Generated: 'Tạo tem', Split: 'Tách tem', Picked: 'Soạn hàng', Unpicked: 'Bỏ soạn hàng',
    Inspected: 'Kiểm tra hàng', Issued: 'Xuất kho', Received: 'Nhập kho', Dispatched: 'Bắt đầu giao',
    RetailerReceived: 'Điểm bán nhận hàng', Invalidated: 'Vô hiệu hóa tem' },
  stock: { Available: 'Sẵn sàng', Picked: 'Đã soạn', InTransit: 'Đang vận chuyển', Delivered: 'Đã giao',
    Invalidated: 'Đã vô hiệu hóa', Split: 'Đã tách', Packed: 'Đã đóng pallet', Dispatched: 'Đã xuất nhà máy', Received: 'Kho đã nhận' },
  documentKind: { Request: 'Yêu cầu kho', Picking: 'Phiếu soạn hàng', Issue: 'Phiếu xuất kho', Receipt: 'Phiếu nhập kho' },
  documentReason: { Transfer: 'Luân chuyển kho', Order: 'Xuất cho đơn hàng', Factory: 'Nhận từ nhà máy' },
  warehouseDocument: { Open: 'Chờ thực hiện', Prepared: 'Đã soạn đủ · chờ xuất', Posted: 'Đã ghi sổ', Fulfilled: 'Đã thực hiện', Cancelled: 'Đã hủy' },
  retailer: { Active: 'Hoạt động', Inactive: 'Ngừng hoạt động', Pending: 'Chờ duyệt', Approved: 'Đã duyệt', Rejected: 'Bị từ chối', Suspended: 'Tạm ngừng' },
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
  method === 'Credit' ? `Công nợ – trả sau ${termDays ?? 0} ngày` : method === 'Prepaid' ? 'Trả trước (chuyển khoản)' : 'Chưa chọn — điểm bán chọn khi duyệt báo giá';
