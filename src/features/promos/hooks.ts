import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { promoApi } from './api';
import { useAuth } from '@/shared/auth/AuthContext';
import type { PromoDetail } from './types';

export const usePromos = () => useQuery({ queryKey: ['promos', 'list'], queryFn: promoApi.list });
export const usePromo = (id: string) => useQuery({ queryKey: ['promos', 'detail', id], queryFn: () => promoApi.get(id) });
export const usePromoLookups = () => ({
  products: useQuery({ queryKey: ['promos', 'products'], queryFn: promoApi.products }),
  categories: useQuery({ queryKey: ['promos', 'categories'], queryFn: promoApi.categories }),
  retailers: useQuery({ queryKey: ['promos', 'retailers'], queryFn: promoApi.retailers }),
});
export const usePromoTargets = (promotion: PromoDetail | undefined) => {
  const { user } = useAuth();
  const scope = [user?.id, user?.role, promotion?.id];
  const enabled = !!promotion && !!user;
  return {
    products: useQuery({ queryKey: ['promos', 'applied-products', ...scope, promotion?.productIds, promotion?.productRules],
      queryFn: () => promoApi.appliedProducts(promotion!), enabled }),
    retailers: useQuery({ queryKey: ['promos', 'applied-retailers', ...scope, promotion?.retailerIds],
      queryFn: () => promoApi.appliedRetailers(promotion!.retailerIds), enabled }),
    categories: useQuery({ queryKey: ['promos', 'applied-categories', ...scope, promotion?.categoryIds],
      queryFn: async () => (await promoApi.categories()).filter(c => promotion!.categoryIds.includes(c.id)),
      enabled: enabled && !!promotion.categoryIds.length }),
  };
};
export const useCreatePromo = () => useApiMutation(promoApi.create, { success: (p) => p.isActive ? `Đã lưu và kích hoạt ${p.name}.` : `Đã lưu nháp ${p.name}. Kích hoạt khi sẵn sàng áp dụng.` });
export const usePausePromo = () => useApiMutation(promoApi.pause, { success: (p) => `Đã tạm dừng ${p.name}. Đơn mới tính giá không còn khuyến mãi này.` });
export const useActivatePromo = () => useApiMutation(promoApi.activate, { success: (p) => `Đã kích hoạt lại ${p.name}.` });
