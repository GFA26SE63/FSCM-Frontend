import { get, post } from '@/shared/api/http';
import { graphql } from '@/shared/api/graphql';
import type { CategoryOption, ProductOption, PromoDetail, PromoInput, PromoSummary, RetailerOption } from './types';

async function allPages<T extends { id: string }>(url: string, filters: object = {}): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  for (let page = 1; ; page++) {
    const result = await get<T[] | { items: T[]; totalCount: number }>(url, { ...filters, page, pageSize: 100 });
    if (Array.isArray(result)) return result;
    if (!result || !Array.isArray(result.items) || !Number.isInteger(result.totalCount) || result.totalCount < 0)
      throw new Error('Máy chủ trả về danh sách không hợp lệ. Vui lòng tải lại.');
    for (const row of result.items) {
      if (seen.has(row.id)) throw new Error('Danh sách thay đổi khi tải. Vui lòng tải lại.');
      seen.add(row.id); rows.push(row);
    }
    if (rows.length >= result.totalCount) return rows;
    if (!result.items.length) throw new Error('Chưa tải đủ danh sách. Vui lòng tải lại.');
  }
}

async function selectedRecords<T>(url: string, ids: string[]): Promise<T[]> {
  const distinct = [...new Set(ids)];
  const rows: T[] = [];
  // Bound concurrent requests while retrieving exact IDs, independent of catalog paging or status.
  for (let i = 0; i < distinct.length; i += 8)
    rows.push(...await Promise.all(distinct.slice(i, i + 8).map(id => get<T>(`${url}/${encodeURIComponent(id)}`))));
  return rows;
}

/** Product/retailer lists use pageSize (not size); detail scopes retrieve exact IDs. */
export const promoApi = {
  list: async () => {
    const data = await graphql<{ entities: { promotionReads: PromoSummary[] } }>(`
      query PromotionReads($includeInactive: Boolean!) {
        entities {
          promotionReads(includeInactive: $includeInactive) {
            id code name promotionType minimumQuantity discountPercent
            startAt endAt isActive
          }
        }
      }
    `, { includeInactive: true });
    return data.entities.promotionReads;
  },
  get: (id: string) => get<PromoDetail>(`/promotions/${id}`),
  create: async (input: PromoInput): Promise<PromoDetail> => {
    const saved = await post<PromoDetail[]>('/promotions/campaigns', input);
    if (saved.length === 0) throw new Error('Máy chủ chưa xác nhận chương trình khuyến mãi.');
    return saved[0];
  },
  /** The server calls it deactivate; the screen says "tạm dừng", which is what it means. */
  pause: (id: string) => post<PromoDetail>(`/promotions/${id}/deactivate`),
  activate: (id: string) => post<PromoDetail>(`/promotions/${id}/activate`),
  products: () => allPages<ProductOption>('/products'),
  categories: () => get<CategoryOption[]>('/categories', { includeInactive: true }),
  retailers: () => allPages<RetailerOption>('/retailers'),
  appliedProducts: (promotion: PromoDetail) => selectedRecords<ProductOption>('/products',
    [...promotion.productIds, ...(promotion.productRules ?? []).map(rule => rule.productId)]),
  appliedRetailers: (ids: string[]) => ids.length
    ? selectedRecords<RetailerOption>('/retailers', ids)
    : allPages<RetailerOption>('/retailers', { status: 'Active' }),
  usage: async (programCode: string) => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const from = new Date(Date.parse(`${today}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);
    const res = await get<{
      items: {
        items: {
          id: string;
          acceptedAt: string;
          retailerCode: string;
          retailerName: string;
          orderId: string;
          orderCode: string;
          sku: string;
          productName: string;
          quantity: number;
          totalDiscountAmount: number;
          orderStatus: string;
        }[];
        totalCount: number;
      };
    }>('/reports/promotions', {
      fromDate: from,
      toDate: today,
      exactProgramCode: programCode,
      page: 1,
      pageSize: 50,
    });
    return {
      totalCount: res.items.totalCount,
      items: res.items.items.map(i => ({
        id: i.id,
        at: i.acceptedAt,
        retailerCode: i.retailerCode,
        retailerName: i.retailerName,
        orderId: i.orderId,
        orderCode: i.orderCode,
        itemCode: i.sku,
        itemName: i.productName,
        quantity: i.quantity,
        discountAmount: i.totalDiscountAmount,
        status: i.orderStatus,
      })),
    };
  },
};
