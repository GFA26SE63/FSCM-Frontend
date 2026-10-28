import { get, post, put } from '@/shared/api/http';
import type { Gift, GiftInput } from './types';

export const giftApi = {
  list: () => get<Gift[]>('/loyalty/rewards', { includeInactive: true }).then((items) => items.map((x) => ({ ...x, redeemed: x.redeemed ?? 0, status: x.isActive === false ? 'Paused' : 'Active' }))),
  create: (v: GiftInput) => post<Gift>('/loyalty/rewards', { loyaltyProgramId: v.loyaltyProgramId, name: v.name, description: v.description, imageUrl: v.imageUrl, rewardType: 'Physical', requiredPoints: v.points, availableQuantity: v.stock }),
  update: (v: GiftInput & { id: string }) => put<Gift>(`/loyalty/rewards/${v.id}`, { name: v.name, description: v.description, imageUrl: v.imageUrl, rewardType: 'Physical', requiredPoints: v.points, availableQuantity: v.stock }),
};
