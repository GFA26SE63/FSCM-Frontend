import { get, post } from '@/shared/api/http';
import type { RedeemStep, Redemption, RedemptionApi, RedemptionStatus } from './types';

export const redeemApi = {
  list: () => get<RedemptionApi[]>('/loyalty/redemptions').then((items) => items.map(normalize)),
  /**
   * The server addresses a redemption by identifier and offers no by-code read, so the list is
   * fetched and matched here. Worth replacing with a filtered query once the read side moves to
   * GraphQL; fetching every redemption to show one is not something to leave in place.
   */
  get: (id: string) =>
    get<RedemptionApi[]>('/loyalty/redemptions').then((items) => {
      const found = items.find((x) => x.id === id);
      if (!found) throw new Error(`Không tìm thấy yêu cầu đổi quà ${id}.`);
      return normalize(found);
    }),
  step: (v: { code: string; step: RedeemStep }) =>
    post<RedemptionApi>(`/loyalty/redemptions/${v.code}/${v.step}`).then(normalize),
};

/** Pending and Completed are the server's words for what the screen calls Requested and Done. */
const toStatus = (status: string): RedemptionStatus =>
  status === 'Pending' ? 'Requested' : status === 'Completed' ? 'Done' : (status as RedemptionStatus);

function normalize(x: RedemptionApi): Redemption {
  return {
    code: x.id,
    retailerCode: x.retailerCode ?? '—',
    retailerName: x.retailerName ?? '—',
    giftCode: x.rewardCode,
    giftName: x.rewardName,
    points: x.redeemedPoints,
    requestedAt: x.createdAt,
    status: toStatus(x.status),
    handledNote: '',
    balance: x.balanceAfter,
    // The server does not report held or available separately on a redemption; only the balance
    // after it. Showing the same number three times would invent a distinction that is not there.
    held: 0,
    available: x.balanceAfter,
  };
}
