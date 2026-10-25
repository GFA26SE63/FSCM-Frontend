import { get, post } from '@/shared/api/http';
import type { RedeemStep, Redemption } from './types';

export const redeemApi = {
  list: () => get<Redemption[]>('/loyalty/redemptions').then((items) => items.map(normalize)),
  get: (code: string) => get<any[]>('/loyalty/redemptions').then((items) => normalize(items.find((x) => x.id === code) ?? {})),
  step: (v: { code: string; step: RedeemStep }) => post<Redemption>(`/loyalty/redemptions/${v.code}/${v.step}`).then(normalize),
};

function normalize(x: any): Redemption {
  return { code: x.id, retailerCode: x.retailerCode ?? '—', retailerName: x.retailerName ?? '—', giftCode: x.rewardCode, giftName: x.rewardName, points: x.redeemedPoints, requestedAt: x.createdAt, status: x.status === 'Pending' ? 'Requested' : x.status === 'Completed' ? 'Done' : x.status, handledNote: '', balance: x.balanceAfter, held: 0, available: x.balanceAfter };
}
