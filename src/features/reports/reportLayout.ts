import type { PortalRole } from '@/shared/auth/roles';
import type { ReportKind } from './types';

export function summaryColumns(count: number, perRow = 6) {
  if (count <= 0) return 1;
  return count <= perRow ? count : Math.ceil(count / 2);
}

export const REPORT_TITLES: Record<ReportKind, string> = {
  financial: 'Báo cáo tài chính & dòng tiền',
  receivables: 'Báo cáo công nợ & tuổi nợ',
  promotions: 'Báo cáo khuyến mãi & giảm HSD',
  loyalty: 'Báo cáo Loyalty & đổi quà',
  claims: 'Báo cáo khiếu nại & hoàn tiền',
  fulfillment: 'Báo cáo giao nhận & vận hành SLA',
  'inventory-risk': 'Báo cáo rủi ro tồn kho & hủy hàng',
};

export const REPORT_ROLES: Record<ReportKind, readonly PortalRole[]> = {
  financial: ['Admin', 'Operator', 'SalesManager'],
  receivables: ['Admin', 'Operator', 'SalesManager'],
  promotions: ['Admin', 'Operator', 'SalesManager'],
  loyalty: ['Admin', 'Operator', 'SalesManager'],
  claims: ['Admin', 'Operator', 'SalesManager'],
  fulfillment: ['Admin', 'Operator', 'WarehouseKeeper', 'SalesManager'],
  'inventory-risk': ['Admin', 'Operator', 'WarehouseKeeper'],
};

const ALIAS_MAP: Record<string, { kind: ReportKind; defaultTab?: string }> = {
  financial: { kind: 'financial' },
  receivables: { kind: 'receivables' },
  promotions: { kind: 'promotions' },
  loyalty: { kind: 'loyalty' },
  redemptions: { kind: 'loyalty', defaultTab: 'redemptions' },
  claims: { kind: 'claims' },
  fulfillment: { kind: 'fulfillment' },
  'inventory-risk': { kind: 'inventory-risk' },
  disposals: { kind: 'inventory-risk', defaultTab: 'disposals' },
};

export function normalizeReportKind(requested: string | null, role?: PortalRole): { kind: ReportKind; initialTab?: string } {
  if (requested && ALIAS_MAP[requested]) return ALIAS_MAP[requested];
  return { kind: role === 'WarehouseKeeper' ? 'inventory-risk' : 'financial' };
}

export function canAccessReport(kind: ReportKind, role?: PortalRole): boolean {
  return Boolean(role && REPORT_ROLES[kind].includes(role));
}

export const STATUS_LABELS: Record<string, string> = {
  Pending: 'Chờ duyệt',
  Approved: 'Đã duyệt',
  Delivered: 'Đã giao',
  Completed: 'Hoàn tất',
  Rejected: 'Từ chối',
  Cancelled: 'Đã hủy',
  PendingRefund: 'Chờ chuyển hoàn',
  AwaitingVerification: 'Chờ xác minh hoàn tiền',
  EvidenceRejected: 'Từ chối chứng từ',
  Refunded: 'Đã hoàn tiền',
  Current: 'Chưa đến hạn',
  Overdue_1_7: 'Quá hạn 1–7 ngày',
  Overdue_8_30: 'Quá hạn 8–30 ngày',
  Overdue_31_Plus: 'Quá hạn > 30 ngày',
  Settled: 'Đã tất toán',
  Unpaid: 'Chưa thanh toán',
  PartiallyPaid: 'Thanh toán một phần',
  Paid: 'Đã thanh toán',
  Overdue: 'Quá hạn',
  Prepaid: 'Trả trước',
  Credit: 'Công nợ',
  Campaign: 'Chiến dịch KM',
  ShelfLife: 'Giảm theo HSD',
  Combined: 'Kết hợp CTKM + HSD',
  Earned: 'Tích điểm',
  EarnedAdjusted: 'Điều chỉnh điểm tích',
  RedemptionHeld: 'Giữ điểm đổi quà',
  RedemptionRejected: 'Hoàn điểm từ chối',
  RedemptionCompleted: 'Hoàn tất đổi quà',
  PendingEarn: 'Điểm chờ cộng',
  PendingEarnCancelled: 'Hủy điểm chờ',
  Expired: 'Đã hết hạn',
  NearExpiry: 'Cận hạn',
  Complaint: 'Khiếu nại',
  Return: 'Trả hàng',
  DamagedCollection: 'Thu hồi hàng hỏng',
  DebtOffset: 'Cấn trừ công nợ',
  Refund: 'Hoàn tiền mặt',
  Open: 'Đang mở',
  UnderReview: 'Đang xem xét',
  CollectionPending: 'Chờ thu hồi',
  Resolved: 'Đã xử lý',
  Closed: 'Đã đóng',
  WaitingToPick: 'Chờ soạn hàng',
  Ready: 'Sẵn sàng xuất',
  Issued: 'Đã xuất kho',
  Delivering: 'Đang giao hàng',
  Received: 'Đã nhận hàng',
  Exception: 'Ngoại lệ',
  InProgress: 'Đang soạn',
  Posted: 'Đã ghi sổ',
  Requested: 'Đã yêu cầu',
  InTransit: 'Đang vận chuyển',
  Active: 'Đang khóa',
  Released: 'Đã mở khóa',
  WrittenOff: 'Đã tiêu hủy',
  Damaged: 'Hư hỏng',
  QualityHold: 'Chờ kiểm tra CL',
  Recall: 'Thu hồi',
  Other: 'Khác',
};

export function labelOf(code?: string | null): string {
  if (!code) return '—';
  return STATUS_LABELS[code] ?? code;
}

export function rangeError(fromDate: string, toDate: string): string | null {
  if (!fromDate || !toDate) return 'Chọn đủ Từ ngày và Đến ngày.';
  const days = (Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000;
  if (!Number.isFinite(days)) return 'Ngày không hợp lệ.';
  if (days < 0 || days > 366) return 'Chọn khoảng ngày hợp lệ, tối đa 367 ngày.';
  return null;
}
