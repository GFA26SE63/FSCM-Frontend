import { get, post } from '@/shared/api/http';
import { fetchRedemptionById } from './redeemGraphql';
import type { RedeemStep, Redemption, RedemptionApi, RedemptionStatus } from './types';

export const redeemApi = {
  list: () => get<RedemptionApi[]>('/loyalty/redemptions').then((items) => items.map(normalize)),
  /** By-id read via GraphQL (one row + one batched enrichment); REST has no by-id read. */
  get: (id: string) => fetchRedemptionById(id).then(normalize),
  step: (v: { code: string; step: RedeemStep }) =>
    post<RedemptionApi>(`/loyalty/redemptions/${v.code}/${v.step}`).then(normalize),
};

/** Pending and Completed are the server's words for what the screen calls Requested and Done. */
const toStatus = (status: string): RedemptionStatus =>
  status === 'Pending' ? 'Requested' : status === 'Completed' ? 'Done' : (status as RedemptionStatus);

export function normalizeRedemption(x: RedemptionApi): Redemption { return normalize(x); }
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
    handledNote: x.updatedAt,
    quantity: x.quantityIsEstimated ? null : x.quantity,
    updatedAt: x.updatedAt,
    regionId: x.regionId,
    salesGroupIds: x.salesGroupIds ?? [],
    balance: x.balanceAfter,
    // Legacy responses may omit the held balance; retain unknown rather than inventing zero.
    held: x.heldPoints ?? null,
    available: x.balanceAfter,
  };
}
