import { del, get, getAll, post, put } from '@/shared/api/http';
import { ApiError } from '@/shared/api/errors';
import type {
  AreaOption,
  GroupOption,
  LoyaltyBalance,
  MlorConfigItem,
  MlorRow,
  Registration,
  Retailer,
  RetailerInput,
  RetailerMlorResolution,
  RetailerOrderEligibility,
  RetailerReceivable,
  ReviewCreditTermsInput,
  SetMlorPayload,
  UpdateRetailerDeclarationPayload,
  UpdateRetailerProfilePayload,
} from './types';

export const retailerApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string; status?: string; scope?: string }) =>
    get<{ items: Retailer[]; totalCount: number; page?: number; pageSize?: number; totalPages?: number }>('/retailers', {
      page: 1,
      pageSize: 100,
      ...params,
    }),
  listAll: () => getAll<Retailer>('/retailers'),
  get: async (identifier: string): Promise<Retailer> => {
    if (!identifier) {
      throw new ApiError(400, 'Mã điểm bán không hợp lệ.');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    // Nếu identifier là UUID hợp lệ, gọi trực tiếp endpoint chuẩn GET /api/v1/retailers/{retailerId}
    if (isUuid) {
      return get<Retailer>(`/retailers/${encodeURIComponent(identifier)}`);
    }

    // Nếu identifier là code (ví dụ mã 8 chữ số 10000001):
    // Tra cứu ID thực tế từ API danh sách thật: GET /api/v1/retailers?search=...
    const page = await get<{ items: Retailer[]; totalCount: number }>('/retailers', {
      search: identifier,
      pageSize: 50,
    });

    const match = page.items?.find(
      (r) =>
        r.code?.toLowerCase() === identifier.toLowerCase() ||
        r.id === identifier,
    );

    if (!match?.id) {
      throw new ApiError(
        404,
        'Không tìm thấy Retailer này. Thông tin có thể đã được thay đổi hoặc không còn tồn tại.',
      );
    }

    // Luôn tải chi tiết thực tế từ endpoint chuẩn GET /api/v1/retailers/{retailerId}
    return get<Retailer>(`/retailers/${encodeURIComponent(match.id)}`);
  },
  create: (v: RetailerInput) => post<Retailer>('/retailers', v),
  update: (v: RetailerInput & { code: string }) => put<Retailer>(`/retailers/${v.code}`, v),
  updateProfile: async (
    retailerId: string,
    payload: UpdateRetailerProfilePayload,
  ): Promise<Retailer> => {
    if (!retailerId) throw new ApiError(400, 'Mã định danh điểm bán không hợp lệ.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(retailerId)) {
      const existing = await retailerApi.get(retailerId);
      if (!existing.id) throw new ApiError(404, 'Không tìm thấy định danh điểm bán để cập nhật.');
      retailerId = existing.id;
    }
    return put<Retailer>(`/retailers/${encodeURIComponent(retailerId)}/profile`, payload);
  },
  updateDeclaration: async (
    retailerId: string,
    payload: UpdateRetailerDeclarationPayload,
  ): Promise<Retailer> => {
    if (!retailerId) {
      throw new ApiError(400, 'Mã định danh điểm bán không hợp lệ.');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(retailerId);
    if (!isUuid) {
      const existing = await retailerApi.get(retailerId);
      if (!existing.id) {
        throw new ApiError(404, 'Không tìm thấy định danh điểm bán để cập nhật.');
      }
      retailerId = existing.id;
    }

    return put<Retailer>(`/retailers/${encodeURIComponent(retailerId)}/declaration`, payload);
  },
  registrations: () => getAll<Registration>('/retailer-registrations'),
  registration: (code: string) => get<Registration>(`/retailer-registrations/${encodeURIComponent(code)}`),
  approve: (code: string) => post<{ registration: Registration; retailer: Retailer }>(`/retailer-registrations/${encodeURIComponent(code)}/approve`),
  reject: (v: { code: string; reason: string }) => post<Registration>(`/retailer-registrations/${encodeURIComponent(v.code)}/reject`, { reason: v.reason }),
  mlor: (code: string) => get<MlorRow[]>(`/retailers/${encodeURIComponent(code)}/mlor`),
  saveMlor: (v: { code: string; items: { sku: string; mlor: number }[] }) => put(`/retailers/${encodeURIComponent(v.code)}/mlor`, { items: v.items }),
  mlorConfigs: (retailerId: string, includeInactive = false) =>
    get<MlorConfigItem[]>('/mlor-configurations', { retailerId, includeInactive }),
  setMlor: (payload: SetMlorPayload) =>
    post<MlorConfigItem>('/mlor-configurations', payload),
  deleteMlor: (mlorId: string) =>
    del<void>(`/mlor-configurations/${encodeURIComponent(mlorId)}`),
  resolveMlor: (retailerId: string, productId: string) =>
    get<RetailerMlorResolution>(`/retailers/${encodeURIComponent(retailerId)}/mlor-resolution`, { productId }),
  areas: async (): Promise<AreaOption[]> => {
    try {
      const list = await getAll<{ id: string; code: string | null; name: string | null }>('/regions');
      return list.map((r) => ({
        id: r.id,
        code: r.code || r.id,
        name: r.name || r.code || r.id,
      }));
    } catch {
      return [];
    }
  },
  groups: async (): Promise<GroupOption[]> => {
    try {
      const list = await getAll<{
        id: string;
        code: string | null;
        name: string | null;
        regionCode: string | null;
        regionId: string;
      }>('/sales-groups');
      return list.map((g) => ({
        id: g.id,
        code: g.code || g.id,
        name: g.name || g.code || g.id,
        areaCode: g.regionCode || g.regionId || '',
        regionId: g.regionId,
      }));
    } catch {
      return [];
    }
  },
  receivables: async (retailerId?: string, retailerCode?: string) => {
    try {
      const list = await getAll<RetailerReceivable>('/receivables');
      return list.filter((r) =>
        Boolean(
          (retailerId && r.retailerId === retailerId) ||
          (retailerCode && r.retailerCode === retailerCode) ||
          (retailerCode && r.orderCode?.includes(retailerCode)),
        ),
      );
    } catch {
      return [];
    }
  },
  loyalty: async (retailerIdOrCode: string) => {
    if (!retailerIdOrCode) return null as unknown as LoyaltyBalance;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(retailerIdOrCode);
    const url = isUuid
      ? `/loyalty/cards/${encodeURIComponent(retailerIdOrCode)}`
      : `/loyalty/cards/by-code/${encodeURIComponent(retailerIdOrCode)}`;
    return get<LoyaltyBalance>(url);
  },
  eligibility: (retailerId: string) =>
    get<RetailerOrderEligibility>(`/retailers/${encodeURIComponent(retailerId)}/order-eligibility`),
  updateCreditTerms: async (v: ReviewCreditTermsInput): Promise<Retailer> => {
    try {
      return await post<Retailer>(`/retailers/${encodeURIComponent(v.retailerId)}/review`, {
        approve: true,
        creditTermDays: v.creditTermDays,
        ...(v.creditLimit !== undefined ? { creditLimit: v.creditLimit } : {}),
        reason: v.reason ?? null,
      });
    } catch {
      return await put<Retailer>(`/retailers/${encodeURIComponent(v.retailerId)}`, {
        creditTermDays: v.creditTermDays,
        reviewReason: v.reason ?? null,
      });
    }
  },
};
