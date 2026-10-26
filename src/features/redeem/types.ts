export type RedemptionStatus = 'Requested' | 'Approved' | 'Delivered' | 'Done' | 'Rejected';
export interface Redemption {
  code: string; retailerCode: string; retailerName: string; giftCode: string; giftName: string; points: number; requestedAt: string;
  status: RedemptionStatus; handledNote: string; balance: number; held: number; available: number;
}
export type RedeemStep = 'approve' | 'reject' | 'deliver' | 'complete';

/**
 * The server's own shape (RedemptionResult). Kept separate from `Redemption`, which is what the
 * screen renders: the portal speaks in codes and the server in identifiers, so the mapping is
 * explicit rather than an `any` cast.
 */
export interface RedemptionApi {
  id: string;
  retailerId: string;
  rewardId: string;
  rewardCode: string;
  rewardName: string;
  quantity: number;
  redeemedPoints: number;
  status: string;
  balanceAfter: number;
  clientRequestId: string;
  createdAt: string;
  updatedAt: string;
  retailerCode: string | null;
  retailerName: string | null;
}
