import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { redeemApi } from './api';
import { redemptionFeedback } from './policy';

export const useRedemptions = () => useQuery({ queryKey: ['redeem', 'list'], queryFn: redeemApi.list });
export const useRedemption = (code: string) => useQuery({ queryKey: ['redeem', 'detail', code], queryFn: () => redeemApi.get(code) });
export const useRedeemStep = () => useApiMutation(redeemApi.step, { permission: 'redeem.manage', success: (_, v) => redemptionFeedback[v.step] });
