import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { loyaltyApi } from './api';

export const useProgram = () => useQuery({ queryKey: ['loyalty', 'program'], queryFn: loyaltyApi.program });
export const useBalances = () => useQuery({ queryKey: ['loyalty', 'balances'], queryFn: loyaltyApi.balances });
export const useRetailerLoyalty = (code: string) => useQuery({ queryKey: ['loyalty', 'retailer', code], queryFn: () => loyaltyApi.retailer(code) });
export const useUpdateProgram = () => useApiMutation(loyaltyApi.updateProgram, {
  permission: 'loyalty.manage',
  success: 'Đã cập nhật chương trình loyalty.',
});
