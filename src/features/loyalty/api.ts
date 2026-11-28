import { get, post, put } from '@/shared/api/http';
import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import type { LoyaltyCardApi, LoyaltyProgram, ProgramInput, ProgramRetailerOption, RetailerLoyalty } from './types';
import type { RedemptionApi } from '@/features/redeem/types';

const programBody = (v: ProgramInput): ProgramInput => ({
  name: v.name, description: v.description, spendAmountPerPoint: v.spendAmountPerPoint,
  minimumRedeemPoints: v.minimumRedeemPoints, startAt: v.startAt, endAt: v.endAt,
  pointsExpireAt: v.pointsExpireAt, retailerIds: [...new Set(v.retailerIds)],
});

function requireProgram(p: LoyaltyProgram): LoyaltyProgram {
  if (!p || !p.id || !p.code || !p.name || typeof p.isActive !== 'boolean' ||
      !Number.isFinite(p.spendAmountPerPoint) || !Number.isInteger(p.minimumRedeemPoints) ||
      !Number.isFinite(Date.parse(p.startAt)) || !Number.isFinite(Date.parse(p.endAt)) ||
      !Array.isArray(p.retailerIds) || p.retailerIds.some((id) => typeof id !== 'string') ||
      (p.pointsExpireAt != null && !Number.isFinite(Date.parse(p.pointsExpireAt)))) {
    throw new ApiError(502, 'Phản hồi chương trình tích điểm không hợp lệ.');
  }
  return p;
}

const toRetailerLoyalty = (card: LoyaltyCardApi): RetailerLoyalty => ({
  retailerCode: card.retailerCode, retailerName: card.retailerName, balance: card.availablePoints,
  held: card.heldPoints, available: card.availablePoints, pendingOrders: card.pendingPoints,
  lastEarned: card.ledger.find((x) => x.transactionType === 'Earned') ? { date: card.ledger.find((x) => x.transactionType === 'Earned')!.createdAt, points: card.ledger.find((x) => x.transactionType === 'Earned')!.points } : null,
  programCode: card.programCode ?? '—', programName: card.programName ?? '—', pointsExpireOn: card.pointsExpireAt ?? '', programs: card.eligiblePrograms,
  ledger: card.ledger.map((x) => ({ date: x.createdAt, description: x.note ?? x.transactionType, kind: x.transactionType, points: x.points,
    balanceAfter: x.balanceAfter, salesOrderId: x.salesOrderId, orderCode: x.orderCode,
    redemptionId: x.redemptionId, redemptionStatus: x.redemptionStatus })),
  redemptions: [],
});

export const loyaltyApi = {
  programRetailersPage: async (page: number, search: string, pageSize = 10): Promise<{ items: ProgramRetailerOption[]; totalCount: number }> => {
    if (![10, 20, 50].includes(pageSize)) throw new ApiError(400, 'Số nhà bán lẻ mỗi trang phải là 10, 20 hoặc 50.');
    const data = await graphql<{ entities: { retailerProfiles: { items: ProgramRetailerOption[]; totalCount: number } } }>(`
      query ProgramRetailerPage($page: Int!, $search: String) {
        entities { retailerProfiles(page: $page, pageSize: ${pageSize}, search: $search, status: "Active") {
          items { id code name status contactName phone email address } totalCount
        } }
      }`, { page, search: search.trim() || null });
    const result = data.entities?.retailerProfiles;
    if (!result || !Array.isArray(result.items) || !Number.isInteger(result.totalCount) || result.totalCount < 0 ||
        result.items.some(item => !item.id || !item.code || !item.name || typeof item.status !== 'string')) {
      throw new ApiError(502, 'Không tải được danh sách nhà bán lẻ áp dụng.');
    }
    return result;
  },
  activeProgramRetailers: async (): Promise<ProgramRetailerOption[]> => {
    const rows: ProgramRetailerOption[] = [];
    const seen = new Set<string>();
    let total: number | undefined;
    for (let page = 1; ; page++) {
      const result = await loyaltyApi.programRetailersPage(page, '', 50);
      total ??= result.totalCount;
      if (result.totalCount !== total || (!result.items.length && rows.length < total))
        throw new ApiError(409, 'Danh sách nhà bán lẻ đã thay đổi. Vui lòng chọn lại.');
      for (const row of result.items) {
        if (row.status !== 'Active' || seen.has(row.id))
          throw new ApiError(409, 'Danh sách nhà bán lẻ đã thay đổi. Vui lòng chọn lại.');
        seen.add(row.id);
        rows.push(row);
      }
      if (rows.length > total) throw new ApiError(409, 'Danh sách nhà bán lẻ đã thay đổi. Vui lòng chọn lại.');
      if (rows.length === total) return rows;
    }
  },
  programs: async (): Promise<LoyaltyProgram[]> => {
    const data = await get<LoyaltyProgram[]>('/loyalty/programs', { includeInactive: true });
    if (!Array.isArray(data)) throw new ApiError(502, 'Thiếu danh sách chương trình tích điểm.');
    return data.map(requireProgram);
  },
  createProgram: (v: ProgramInput) => post<LoyaltyProgram>('/loyalty/programs', programBody(v)).then(requireProgram),
  setProgramActive: (v: { id: string; active: boolean }) =>
    post<LoyaltyProgram>(`/loyalty/programs/${encodeURIComponent(v.id)}/${v.active ? 'activate' : 'deactivate'}`).then(requireProgram),
  programRetailers: async (): Promise<ProgramRetailerOption[]> => {
    const result: ProgramRetailerOption[] = [];
    for (let page = 1; ; page += 1) {
      const data = await get<{ items: ProgramRetailerOption[]; totalCount: number }>('/retailers', { page, pageSize: 100 });
      if (!data || !Array.isArray(data.items) || !Number.isInteger(data.totalCount) || data.totalCount < 0 ||
          data.items.some((r) => !r.id || !r.code || !r.name || typeof r.status !== 'string')) {
        throw new ApiError(502, 'Phản hồi danh sách nhà bán lẻ không hợp lệ.');
      }
      if (data.items.length === 0 && result.length < data.totalCount) {
        throw new ApiError(502, 'Danh sách nhà bán lẻ chưa được tải đầy đủ.');
      }
      result.push(...data.items);
      if (result.length >= data.totalCount) return result;
    }
  },
  // Retain the existing active-program read used by GiftsPage until F72 is reviewed.
  program: () => get<LoyaltyProgram[]>('/loyalty/programs').then((x) => x[0]),
  updateProgram: (v: ProgramInput & { id: string }) =>
    put<LoyaltyProgram>(`/loyalty/programs/${encodeURIComponent(v.id)}`, programBody(v)).then(requireProgram),
  balances: () => get<LoyaltyCardApi[]>('/loyalty/cards').then((items) => items.map(toRetailerLoyalty)),
  retailer: async (code: string): Promise<RetailerLoyalty> => {
    const [card, redemptions] = await Promise.all([
      get<LoyaltyCardApi>(`/loyalty/cards/by-code/${encodeURIComponent(code)}`),
      get<RedemptionApi[]>('/loyalty/redemptions'),
    ]);
    return { ...toRetailerLoyalty(card), redemptions: redemptions.filter(x => x.retailerId === card.retailerId).map(x => ({
      code: x.id, giftCode: x.rewardCode, giftName: x.rewardName, points: x.redeemedPoints, requestedAt: x.createdAt,
      status: (x.status === 'Pending' ? 'Requested' : x.status === 'Completed' ? 'Done' : x.status) as RetailerLoyalty['redemptions'][number]['status'],
    })) };
  },
};
