import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { giftApi } from './api';
import type { GiftFilters } from './types';

export const useGifts = (filters: GiftFilters) => useQuery({ queryKey: ['gifts', 'list', filters], queryFn: () => giftApi.list(filters) });
export const useGiftPrograms = () => useQuery({ queryKey: ['gifts', 'programs'], queryFn: giftApi.programs });
export const useCreateGift = () => useApiMutation(giftApi.create, { permission: 'loyalty.manage' });
export const useUpdateGift = () => useApiMutation(giftApi.update, { permission: 'loyalty.manage' });
