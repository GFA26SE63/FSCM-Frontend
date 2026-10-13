/** SPEC §9 – status codes (API, English) ↔ UI labels (Vietnamese, as in the prototype). */
export const statusLabels = {
  order: { Pending: 'Chờ duyệt', Approved: 'Đã duyệt', Picking: 'Đang soạn hàng', Shipped: 'Đã xuất kho', Delivering: 'Đang giao', Delivered: 'Đã giao', Completed: 'Hoàn tất', Rejected: 'Bị từ chối', Cancelled: 'Đã hủy' },
  receivable: { AwaitingDelivery: 'Chờ giao', Unpaid: 'Chưa thu', Paid: 'Đã thu đủ', Overdue: 'Quá hạn' },
  product: { Draft: 'Nháp', Published: 'Đã publish', Inactive: 'Inactive' },
  transfer: { Suggested: 'Gợi ý', InTransit: 'Đang vận chuyển', Received: 'Đã nhận', Cancelled: 'Đã hủy' },
  transferKind: { Replenishment: 'Bổ sung', NearExpiryRotation: 'Luân chuyển cận hạn' },
  rotation: { Proposed: 'Đề xuất', Approved: 'Đã duyệt', Skipped: 'Bỏ qua', Expired: 'Hết hạn', DiscountSuggested: 'Gợi ý giảm giá', NoDestination: 'Không có kho đích' },
  gift: { Requested: 'Chờ duyệt', Approved: 'Đã duyệt', Delivered: 'Đang giao quà', Done: 'Hoàn tất', Rejected: 'Bị từ chối' },
  vehicle: { Active: 'Hoạt động', Maintenance: 'Bảo trì' },
  driver: { Active: 'Hoạt động', OnLeave: 'Tạm nghỉ' },
  active: { Active: 'Hoạt động', Inactive: 'Inactive', Locked: 'Đã khóa', Paused: 'Tạm ngừng' },
  promotion: { Running: 'Đang chạy', Paused: 'Tạm dừng', Ended: 'Hết hiệu lực' },
  batchDiscount: { Active: 'Đang áp dụng', Ended: 'Hết hiệu lực' },
  expiry: { Normal: 'Bình thường', NearExpiry: 'Cận hạn', Expired: 'Hết hạn', Disposed: 'Đã tiêu hủy' },
  picking: { NotPicked: 'Chưa pick', Picking: 'Đang pick', Shipped: 'Đã xuất' },
  complaint: { Open: 'Chờ xử lý', Resolved: 'Đã xử lý' },
  registration: { Pending: 'Chờ duyệt', Approved: 'Đã duyệt', Rejected: 'Bị từ chối' },
  receipt: { Posted: 'Đã nhập' },
  disposal: { Disposed: 'Đã tiêu hủy' },
  kpi: { Achieved: 'Đạt', NotAchieved: 'Chưa đạt' },
  channel: { Online: 'Online', Offline: 'Offline' },
  warehouseType: { Central: 'Kho tổng', Regional: 'Kho vùng' },
  loyaltyProgram: { Running: 'Đang chạy', Paused: 'Tạm dừng' },
} as const;

export type StatusDomain = keyof typeof statusLabels;

export function statusLabel(domain: StatusDomain, code: string): string {
  const map = statusLabels[domain] as Record<string, string>;
  return map[code] ?? code;
}

export const paymentLabel = (method: string, termDays?: number | null): string =>
  method === 'Credit' ? `Công nợ – trả sau ${termDays ?? 0} ngày` : method === 'Prepaid' ? 'Trả trước (QR / tiền mặt)' : 'COD';
