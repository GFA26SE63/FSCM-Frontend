import { getAll, post, put } from '@/shared/api/http';
import type { Gift, GiftInput } from './types';

export const giftApi = {
  list: () => getAll<Gift>('/gifts'),
  create: (v: GiftInput) => post<Gift>('/gifts', v),
  update: (v: GiftInput & { code: string }) => put<Gift>(`/gifts/${v.code}`, v),
};
