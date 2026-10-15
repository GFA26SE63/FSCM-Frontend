import { get, getAll, post } from '@/shared/api/http';
import type { RedeemStep, Redemption } from './types';

export const redeemApi = {
  list: () => getAll<Redemption>('/gift-redemptions'),
  get: (code: string) => get<Redemption>(`/gift-redemptions/${code}`),
  step: (v: { code: string; step: RedeemStep }) => post<Redemption>(`/gift-redemptions/${v.code}/${v.step}`),
};
