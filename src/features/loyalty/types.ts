export interface Gift { code: string; name: string; points: number; stock: number; redeemed: number; status: 'Active' | 'Paused' }
export interface LoyaltyProgram {
  id?: string; code: string; name: string; description?: string | null;
  spendAmountPerPoint?: number; minimumRedeemPoints?: number; startAt?: string; endAt?: string;
  pointsExpireAt?: string | null; retailerIds?: string[]; isActive?: boolean;
  scope?: string; validFrom?: string; validTo?: string; pointsExpireOn?: string;
  status?: 'Running' | 'Paused'; pointRateVnd?: number; gifts?: Gift[];
}
export interface BalanceRow {
  retailerCode: string; retailerName: string; balance: number; held: number; available: number; pendingOrders: number; lastEarned: { date: string; points: number } | null;
}
export interface LedgerEntry { date: string; description: string; kind: 'Earned' | 'Pending' | 'Redeemed' | 'Refunded'; points: number | null }
export interface RedemptionRow { code: string; giftCode: string; giftName: string; points: number; requestedAt: string; status: 'Requested' | 'Approved' | 'Delivered' | 'Done' | 'Rejected' }
export interface RetailerLoyalty extends BalanceRow { programCode: string; programName: string; pointsExpireOn: string; ledger: LedgerEntry[]; redemptions: RedemptionRow[] }
export interface LoyaltyCardApi {
  retailerId: string; retailerCode: string; retailerName: string; programId?: string; programCode?: string;
  programName?: string; availablePoints: number; heldPoints: number; pendingPoints: number;
  expiredPoints: number; pointsExpireAt?: string | null;
  ledger: { transactionId: string; transactionType: string; points: number; balanceAfter: number; note?: string | null; createdAt: string; orderCode?: string | null; redemptionId?: string | null; redemptionStatus?: string | null }[];
}
export interface ProgramInput {
  id?: string; name: string; description?: string | null; spendAmountPerPoint: number;
  minimumRedeemPoints: number; startAt: string; endAt: string; pointsExpireAt?: string | null;
  retailerIds: string[];
}
