import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { promoApi } from './api';

export const usePromos = () => useQuery({ queryKey: ['promos', 'list'], queryFn: promoApi.list });
export const usePromo = (id: string) => useQuery({ queryKey: ['promos', 'detail', id], queryFn: () => promoApi.get(id) });
export const usePromoLookups = () => ({
  products: useQuery({ queryKey: ['promos', 'products'], queryFn: promoApi.products }),
  categories: useQuery({ queryKey: ['promos', 'categories'], queryFn: promoApi.categories }),
  retailers: useQuery({ queryKey: ['promos', 'retailers'], queryFn: promoApi.retailers }),
});
export const useCreatePromo = () => useApiMutation(promoApi.create, { success: (p) => `Đã tạo chương trình khuyến mãi ${p.code}.` });
export const usePausePromo = () => useApiMutation(promoApi.pause, { success: (p) => `Đã tạm dừng ${p.code}. Đơn mới tính giá không còn khuyến mãi này.` });
export const useActivatePromo = () => useApiMutation(promoApi.activate, { success: (p) => `Đã kích hoạt lại ${p.code}.` });
