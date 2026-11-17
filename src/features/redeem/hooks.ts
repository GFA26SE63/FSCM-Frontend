import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { redeemApi } from './api';
import type { RedeemStep } from './types';

const done: Record<RedeemStep, string> = {
  approve: 'Đã duyệt: trừ điểm điểm bán và trừ tồn quà.',
  reject: 'Đã từ chối: điểm đang giữ được trả lại điểm bán.',
  deliver: 'Đã chuyển sang Đang giao quà.',
  complete: 'Đã hoàn tất đổi quà.',
};
export const useRedemptions = () => useQuery({ queryKey: ['redeem', 'list'], queryFn: redeemApi.list });
export const useRedemption = (code: string) => useQuery({ queryKey: ['redeem', 'detail', code], queryFn: () => redeemApi.get(code) });
export const useRedeemStep = () => useApiMutation(redeemApi.step, { permission: 'redeem.manage', success: (_, v) => done[v.step] });
