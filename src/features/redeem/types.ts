export type RedemptionStatus = 'Requested' | 'Approved' | 'Delivered' | 'Done' | 'Rejected';
export interface Redemption {
  code: string; retailerCode: string; retailerName: string; giftCode: string; giftName: string; points: number; requestedAt: string;
  status: RedemptionStatus; handledNote: string; balance: number; held: number; available: number;
}
export type RedeemStep = 'approve' | 'reject' | 'deliver' | 'complete';
