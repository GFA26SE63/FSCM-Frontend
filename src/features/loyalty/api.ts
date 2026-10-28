import { get, put } from '@/shared/api/http';
import type { LoyaltyCardApi, LoyaltyProgram, ProgramInput, RetailerLoyalty } from './types';

const toRetailerLoyalty = (card: LoyaltyCardApi): RetailerLoyalty => ({
  retailerCode: card.retailerCode, retailerName: card.retailerName, balance: card.availablePoints,
  held: card.heldPoints, available: card.availablePoints, pendingOrders: card.pendingPoints,
  lastEarned: card.ledger.find((x) => x.points > 0) ? { date: card.ledger.find((x) => x.points > 0)!.createdAt, points: card.ledger.find((x) => x.points > 0)!.points } : null,
  programCode: card.programCode ?? '—', programName: card.programName ?? '—', pointsExpireOn: card.pointsExpireAt ?? '',
  ledger: card.ledger.map((x) => ({ date: x.createdAt, description: x.note ?? x.transactionType, kind: x.transactionType.includes('Redemption') ? 'Redeemed' : x.transactionType === 'PendingEarn' ? 'Pending' : x.points < 0 ? 'Redeemed' : 'Earned', points: x.points })),
  redemptions: [],
});

export const loyaltyApi = {
  program: () => get<LoyaltyProgram[]>('/loyalty/programs').then((x) => x[0]),
  updateProgram: (v: ProgramInput & { id: string }) => put<LoyaltyProgram>(`/loyalty/programs/${v.id}`, {
    name: v.name, description: v.description, spendAmountPerPoint: v.spendAmountPerPoint,
    minimumRedeemPoints: v.minimumRedeemPoints, startAt: v.startAt, endAt: v.endAt,
    pointsExpireAt: v.pointsExpireAt, retailerIds: v.retailerIds,
  }),
  balances: () => get<LoyaltyCardApi[]>('/loyalty/cards').then((items) => items.map(toRetailerLoyalty)),
  retailer: (code: string) => get<LoyaltyCardApi>(`/loyalty/cards/by-code/${encodeURIComponent(code)}`).then(toRetailerLoyalty),
};
