import { get, http, post, put } from '@/shared/api/http';
import { graphql } from '@/shared/api/graphql';
import { ApiError, errorMessage } from '@/shared/api/errors';
import type { Gift, GiftFilters, GiftInput, GiftPage, GiftProgram, GiftSaveResult } from './types';
import { giftImageError } from './imageUpload';

export const GIFT_PAGE_SIZE = 20;
interface RewardApi {
  id: string; loyaltyProgramId: string; code: string; name: string; description: string | null;
  imageUrl: string | null; requiredPoints: number; availableQuantity: number | null; isActive: boolean;
  rewardType: string; discountAmount: number | null; discountPercent: number | null;
  imageReference?: string | null;
}
const fields = 'id loyaltyProgramId code name description imageUrl requiredPoints availableQuantity isActive rewardType discountAmount discountPercent';
function normalize(x: RewardApi): Gift {
  if (!x?.id || !x.code || !x.loyaltyProgramId || !x.name || !x.rewardType ||
      !Number.isInteger(x.requiredPoints) || x.requiredPoints <= 0 || typeof x.isActive !== 'boolean' ||
      (x.availableQuantity !== null && (!Number.isInteger(x.availableQuantity) || x.availableQuantity < 0))) {
    throw new ApiError(502, 'Phản hồi quà đổi điểm không hợp lệ.');
  }
  return { id: x.id, code: x.code, name: x.name, description: x.description, imageUrl: x.imageUrl,
    imageReference: x.imageReference ?? x.imageUrl,
    points: x.requiredPoints, stock: x.availableQuantity, redeemed: null, status: x.isActive ? 'Active' : 'Paused',
    loyaltyProgramId: x.loyaltyProgramId, rewardType: x.rewardType,
    discountAmount: x.discountAmount, discountPercent: x.discountPercent };
}

async function saveImageAndStatus(gift: Gift, input: GiftInput): Promise<GiftSaveResult> {
  if (input.imageFile) {
    try {
      const form = new FormData();
      form.append('file', input.imageFile);
      const response = await http.post<RewardApi>(`/loyalty/rewards/${gift.id}/image`, form,
        { headers: { 'Content-Type': undefined } });
      gift = normalize(response.data);
    } catch (error) {
      return { gift, imageError: `Thông tin quà đã lưu; chưa xác nhận được kết quả tải ảnh: ${errorMessage(error)}` };
    }
  }
  return saveStatus(gift, input.status);
}

async function saveStatus(gift: Gift, target: Gift['status']): Promise<GiftSaveResult> {
  if (gift.status === target) return { gift };
  try {
    return { gift: normalize(await post<RewardApi>(`/loyalty/rewards/${gift.id}/${target === 'Active' ? 'activate' : 'deactivate'}`)) };
  } catch (error) {
    // Metadata is already persisted: return its identity so retry edits this reward,
    // never creates a second reward after an activation failure.
    return { gift, statusError: `Thông tin quà đã lưu; chưa xác nhận được kết quả đổi trạng thái: ${errorMessage(error)}` };
  }
}

function body(v: GiftInput) {
  const imageError = v.imageFile ? giftImageError(v.imageFile) : undefined;
  if (imageError) throw new ApiError(400, imageError);
  if (v.name.trim().length < 2 || v.name.trim().length > 200 ||
      !Number.isInteger(v.points) || v.points <= 0 || v.points > 2147483647 ||
      (v.stock !== null && (!Number.isInteger(v.stock) || v.stock < 0 || v.stock > 2147483647))) {
    throw new ApiError(400, 'Tên quà, điểm đổi hoặc số lượng quà không hợp lệ.');
  }
  return { name: v.name.trim(), description: v.description?.trim() || null, imageUrl: v.imageUrl?.trim() || null,
    rewardType: v.rewardType || 'Physical', requiredPoints: v.points, availableQuantity: v.stock,
    discountAmount: v.discountAmount ?? null, discountPercent: v.discountPercent ?? null };
}

export const giftApi = {
  list: async (filter: GiftFilters = {}): Promise<GiftPage> => {
    const clauses = [
      ...(filter.search ? ['{ or: [{ code: { contains: $search } }, { name: { contains: $search } }] }'] : []),
      ...(filter.status === 'OutOfStock' ? ['{ availableQuantity: { eq: 0 } }']
        : filter.status ? [`{ isActive: { eq: ${filter.status === 'Active'} } }`] : []),
    ];
    const backwards = !!filter.before;
    const data = await graphql<{ entities: { loyaltyRewards: { nodes: RewardApi[]; totalCount: number; pageInfo: GiftPage['pageInfo'] } } }>(`
      query GiftPage($cursor: String${filter.search ? ', $search: String!' : ''}) {
        entities { loyaltyRewards(${backwards ? 'last' : 'first'}: 20, ${backwards ? 'before' : 'after'}: $cursor,
          ${clauses.length ? `where: { and: [${clauses.join(', ')}] },` : ''}
          order: ${filter.sort === 'oldest' ? '[{ createdAt: ASC }, { id: ASC }]' : filter.sort === 'pointsAsc'
            ? '[{ requiredPoints: ASC }, { id: ASC }]' : filter.sort === 'pointsDesc'
              ? '[{ requiredPoints: DESC }, { id: DESC }]' : '[{ createdAt: DESC }, { id: DESC }]'}) {
          nodes { ${fields} } totalCount pageInfo { startCursor endCursor hasNextPage hasPreviousPage }
        } }
      }
    `, { cursor: filter.before || filter.after || null, ...(filter.search ? { search: filter.search } : {}) });
    const page = data.entities?.loyaltyRewards;
    if (!page || !Array.isArray(page.nodes) || page.nodes.length > GIFT_PAGE_SIZE || !Number.isInteger(page.totalCount) || page.totalCount < 0 ||
        !page.pageInfo || typeof page.pageInfo.hasNextPage !== 'boolean' || typeof page.pageInfo.hasPreviousPage !== 'boolean' ||
        (page.pageInfo.hasNextPage && !page.pageInfo.endCursor) || (page.pageInfo.hasPreviousPage && !page.pageInfo.startCursor)) {
      throw new ApiError(502, 'Thiếu thông tin phân trang danh mục quà.');
    }
    const items = await Promise.all(page.nodes.map(async row => {
      // Entity GraphQL returns the stored key. Resolve a signed image URL only
      // for managed images on this page; collection filtering/paging stays GraphQL.
      if (row.imageUrl?.startsWith('reward/')) {
        const detail = await get<RewardApi>(`/loyalty/rewards/${row.id}`);
        if (detail.id !== row.id || !detail.imageUrl || detail.imageUrl.startsWith('reward/')) {
          throw new ApiError(502, 'Không tải được đường dẫn ảnh quà.');
        }
        return normalize(detail);
      }
      return normalize(row);
    }));
    if (items.length) {
      // Preserve the existing "Đã đổi" column using completed redemption quantities,
      // limited to rewards on this page; legacy rows without a snapshot stay unknown.
      const totals = new Map(items.map(item => [item.id, 0 as number | null]));
      let after: string | null = null;
      do {
        const result: { entities: { rewardRedemptions: {
          nodes: { loyaltyRewardId: string; quantity: number | null; requiredPointsSnapshot: number | null; redeemedPoints: number }[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        } } } = await graphql(`query GiftRedemptionTotals($ids: [UUID!]!, $after: String) {
          entities { rewardRedemptions(first: 100, after: $after,
            where: { loyaltyRewardId: { in: $ids }, status: { eq: "Completed" } }) {
            nodes { loyaltyRewardId quantity requiredPointsSnapshot redeemedPoints }
            pageInfo { hasNextPage endCursor }
          } }
        }`, { ids: items.map(item => item.id), after });
        const connection = result.entities?.rewardRedemptions;
        if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo ||
            (connection.pageInfo.hasNextPage && (!connection.pageInfo.endCursor || connection.pageInfo.endCursor === after))) {
          throw new ApiError(502, 'Không tải đủ dữ liệu số lượng quà đã đổi.');
        }
        for (const row of connection.nodes) {
          if (!totals.has(row.loyaltyRewardId)) throw new ApiError(502, 'Dữ liệu quà đã đổi không khớp bộ lọc.');
          const quantity = row.quantity ?? (row.requiredPointsSnapshot && row.requiredPointsSnapshot > 0
            ? row.redeemedPoints / row.requiredPointsSnapshot : null);
          const prior = totals.get(row.loyaltyRewardId);
          totals.set(row.loyaltyRewardId, prior == null || quantity == null || !Number.isInteger(quantity) ? null : prior + quantity);
        }
        after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
      } while (after);
      for (const item of items) item.redeemed = totals.get(item.id) ?? null;
    }
    return { items, totalCount: page.totalCount, pageInfo: page.pageInfo };
  },
  programs: async (effectiveOnly = false): Promise<GiftProgram[]> => {
    const rows: GiftProgram[] = [];
    const now = effectiveOnly ? new Date().toISOString() : undefined;
    let after: string | null = null;
    do {
      const result: { entities: { loyaltyPrograms: { nodes: GiftProgram[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } } =
        await graphql(`query GiftPrograms($after: String${effectiveOnly ? ', $now: DateTime!' : ''}) { entities {
          loyaltyPrograms(first: 100, after: $after, ${effectiveOnly ? 'where: { isActive: { eq: true }, startAt: { lte: $now }, endAt: { gte: $now } },' : ''} order: [{ code: ASC }]) {
            nodes { id code name isActive } pageInfo { hasNextPage endCursor }
          }
        } }`, { after, ...(effectiveOnly ? { now } : {}) });
      const page = result.entities?.loyaltyPrograms;
      if (!page || !Array.isArray(page.nodes) || !page.pageInfo ||
          (page.pageInfo.hasNextPage && (!page.pageInfo.endCursor || page.pageInfo.endCursor === after))) {
        throw new ApiError(502, 'Không tải đủ chương trình khách hàng thân thiết.');
      }
      rows.push(...page.nodes);
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);
    return rows;
  },
  create: async (v: GiftInput): Promise<GiftSaveResult> => {
    const gift = normalize(await post<RewardApi>('/loyalty/rewards', { ...body(v), loyaltyProgramId: v.loyaltyProgramId }));
    return saveImageAndStatus(gift, v);
  },
  update: async (v: GiftInput & { id: string }): Promise<GiftSaveResult> => {
    const gift = normalize(await put<RewardApi>(`/loyalty/rewards/${v.id}`, body(v)));
    return saveImageAndStatus(gift, v);
  },
};
