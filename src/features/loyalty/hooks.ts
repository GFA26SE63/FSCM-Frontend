import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { useAuth } from '@/shared/auth/AuthContext';
import { loyaltyApi } from './api';

export const usePrograms = () => {
  const { user } = useAuth();
  return useQuery({ queryKey: ['loyalty', 'programs', user?.id], queryFn: loyaltyApi.programs,
    enabled: user?.role === 'Admin' || user?.role === 'Operator' });
};
export const useProgramRetailers = () => {
  const { user } = useAuth();
  return useQuery({ queryKey: ['loyalty', 'program-retailers', user?.id],
    queryFn: loyaltyApi.programRetailers, enabled: user?.role === 'Admin' || user?.role === 'Operator' });
};
export const useCreateProgram = () => useApiMutation(loyaltyApi.createProgram, {
  permission: 'loyalty.manage', success: 'Đã tạo chương trình. Hãy kích hoạt khi sẵn sàng.',
});
export const useSetProgramActive = () => useApiMutation(loyaltyApi.setProgramActive, {
  permission: 'loyalty.manage',
  success: (_, v) => v.active ? 'Đã kích hoạt chương trình.' : 'Đã tạm dừng chương trình.',
});

export const useProgram = () => useQuery({ queryKey: ['loyalty', 'program'], queryFn: loyaltyApi.program });
export const useBalances = () => useQuery({ queryKey: ['loyalty', 'balances'], queryFn: loyaltyApi.balances });
export const useRetailerLoyalty = (code: string) => useQuery({ queryKey: ['loyalty', 'retailer', code], queryFn: () => loyaltyApi.retailer(code) });
export const useUpdateProgram = () => useApiMutation(loyaltyApi.updateProgram, {
  permission: 'loyalty.manage',
  success: 'Đã cập nhật chương trình loyalty.',
});
