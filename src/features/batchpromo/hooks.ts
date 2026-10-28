import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { batchPromoApi } from './api';

export const useBatchDiscounts = () => useQuery({ queryKey: ['batchpromo', 'list'], queryFn: batchPromoApi.list });
export const useDiscountSuggestions = () => useQuery({ queryKey: ['batchpromo', 'suggestions'], queryFn: batchPromoApi.suggestions });
export const useCreateBatchDiscount = () => useApiMutation(batchPromoApi.create, { success: (r) => `Đã tạo ${r.items.length} giảm giá theo HSD: ${r.items.map((d) => d.code).join(', ')}.` });
export const useStopBatchDiscount = () => useApiMutation(batchPromoApi.stop, { success: (d) => `Đã dừng giảm giá ${d.code}.` });
export const scanLabel = batchPromoApi.label;
export const useShelfLifeCurrent = () => useQuery({ queryKey: ['shelf-life-discounts', 'current'], queryFn: batchPromoApi.shelfLifeCurrent });
export const useShelfLifeHistory = () => useQuery({ queryKey: ['shelf-life-discounts', 'history'], queryFn: batchPromoApi.shelfLifeHistory });
export const usePublishShelfLife = () => useApiMutation(batchPromoApi.publishShelfLife, { success: (r) => `Đã publish bảng giảm HSD phiên bản ${r.version}.` });
