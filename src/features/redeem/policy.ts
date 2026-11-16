import type { RedeemStep, RedemptionStatus } from './types';

export function allowedRedeemSteps(status: RedemptionStatus): RedeemStep[] {
  switch (status) {
    case 'Requested': return ['approve', 'reject'];
    case 'Approved': return ['deliver', 'reject'];
    case 'Delivered': return ['complete'];
    default: return [];
  }
}

export const redemptionFeedback: Record<RedeemStep, string> = {
  approve: 'Đã duyệt yêu cầu. Điểm và lượng quà đã được giữ từ lúc gửi yêu cầu.',
  reject: 'Đã từ chối. Điểm và lượng quà đã giữ được trả lại.',
  deliver: 'Đã ghi nhận giao quà. Có thể xác nhận hoàn tất khi việc giao quà đã xong.',
  complete: 'Đã hoàn tất đổi quà. Điểm đang giữ đã chuyển thành điểm đã dùng.',
};
