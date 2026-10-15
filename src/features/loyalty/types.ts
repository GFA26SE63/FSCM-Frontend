export interface Gift { code: string; name: string; points: number; stock: number; redeemed: number; status: 'Active' | 'Paused' }
export interface LoyaltyProgram {
  code: string; name: string; scope: string; validFrom: string; validTo: string; pointsExpireOn: string; status: 'Running' | 'Paused'; pointRateVnd: number; gifts: Gift[];
}
export interface BalanceRow {
  retailerCode: string; retailerName: string; balance: number; held: number; available: number; pendingOrders: number; lastEarned: { date: string; points: number } | null;
}
export interface LedgerEntry { date: string; description: string; kind: 'Earned' | 'Pending' | 'Redeemed' | 'Refunded'; points: number | null }
export interface RedemptionRow { code: string; giftCode: string; giftName: string; points: number; requestedAt: string; status: 'Requested' | 'Approved' | 'Delivered' | 'Done' | 'Rejected' }
export interface RetailerLoyalty extends BalanceRow { programCode: string; programName: string; pointsExpireOn: string; ledger: LedgerEntry[]; redemptions: RedemptionRow[] }
export interface ProgramInput { name: string; scope: string; validFrom: string; validTo: string; pointsExpireOn: string; status: LoyaltyProgram['status']; pointRateVnd: number }
