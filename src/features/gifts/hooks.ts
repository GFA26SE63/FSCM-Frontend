import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { giftApi } from './api';

export const useGifts = () => useQuery({ queryKey: ['gifts', 'list'], queryFn: giftApi.list });
export const useCreateGift = () => useApiMutation(giftApi.create, { success: (g) => `Đã thêm quà ${g.code} · ${g.name}.` });
export const useUpdateGift = () => useApiMutation(giftApi.update, { success: (g) => `Đã cập nhật quà ${g.code}.` });
