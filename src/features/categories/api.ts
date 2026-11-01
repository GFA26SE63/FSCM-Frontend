import { get, patch, post, put } from '@/shared/api/http';
import type { Category, CategoryDetail, CategoryInput, CategoryProduct } from './types';

interface BackendCategory {
  id: string;
  parentCategoryId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  status?: 'Active' | 'Inactive';
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface BackendCategoryDetail extends BackendCategory {
  products?: BackendProduct[];
}

interface BackendProduct {
  id: string;
  productCategoryId?: string;
  categoryId?: string;
  categoryCode?: string;
  categoryName?: string;
  sku: string;
  name: string;
  unit?: string;
  packSpec?: string;
  currentUnitPrice?: number;
  basePrice?: number;
  status: string;
}

const mapCategory = (raw: BackendCategory): Category => {
  const active = raw.isActive ?? (raw.status !== 'Inactive');
  return {
    id: raw.id,
    parentCategoryId: raw.parentCategoryId ?? null,
    code: raw.code,
    name: raw.name,
    description: raw.description ?? '',
    isActive: active,
    status: active ? 'Active' : 'Inactive',
    productCount: raw.productCount ?? 0,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

const mapProduct = (p: BackendProduct): CategoryProduct => ({
  id: p.id,
  sku: p.sku,
  name: p.name,
  packSpec: p.packSpec || p.unit || '—',
  basePrice: p.currentUnitPrice ?? p.basePrice ?? 0,
  status: p.status ?? 'Draft',
});

const isGuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

async function fetchAllProductsForCount(): Promise<BackendProduct[]> {
  try {
    const res = await get<{ items?: BackendProduct[]; totalCount?: number; pageSize?: number } | BackendProduct[]>(
      '/products',
      { page: 1, pageSize: 100 }
    );
    if (!res) return [];
    if (Array.isArray(res)) return res;
    const items = res.items ? [...res.items] : [];
    const totalCount = res.totalCount ?? items.length;
    const pageSize = res.pageSize ?? 100;
    const totalPages = Math.ceil(totalCount / pageSize);

    if (totalPages > 1) {
      const pagePromises = [];
      for (let p = 2; p <= totalPages; p++) {
        pagePromises.push(
          get<{ items?: BackendProduct[] }>('/products', { page: p, pageSize: 100 })
            .then((r) => r?.items ?? [])
            .catch(() => [])
        );
      }
      const rest = await Promise.all(pagePromises);
      for (const pageItems of rest) {
        items.push(...pageItems);
      }
    }
    return items;
  } catch {
    return [];
  }
}

export const categoryApi = {
  /**
   * GET /api/v1/categories?includeInactive=true
   * Read: all authenticated users
   */
  list: async (includeInactive = true): Promise<Category[]> => {
    const [catRes, allProducts] = await Promise.all([
      get<BackendCategory[]>('/categories', { includeInactive }),
      fetchAllProductsForCount(),
    ]);

    const list = Array.isArray(catRes) ? catRes : (((catRes as unknown) as { items?: BackendCategory[] })?.items ?? []);

    // Build product count index by category id, code, and name
    const countById: Record<string, number> = {};
    const countByCode: Record<string, number> = {};
    const countByName: Record<string, number> = {};

    for (const p of allProducts) {
      const catId = p.productCategoryId || p.categoryId;
      if (catId) {
        const idKey = String(catId).toLowerCase();
        countById[idKey] = (countById[idKey] || 0) + 1;
      }
      if (p.categoryCode) {
        const codeKey = String(p.categoryCode).toLowerCase();
        countByCode[codeKey] = (countByCode[codeKey] || 0) + 1;
      }
      if (p.categoryName) {
        const nameKey = String(p.categoryName).toLowerCase().trim();
        countByName[nameKey] = (countByName[nameKey] || 0) + 1;
      }
    }

    const categories = list.map(mapCategory);

    // Assign direct product count first
    for (const cat of categories) {
      const idKey = cat.id?.toLowerCase();
      const codeKey = cat.code?.toLowerCase();
      const nameKey = cat.name?.toLowerCase().trim();
      const directCount =
        (idKey && countById[idKey] !== undefined ? countById[idKey] : undefined) ??
        (codeKey && countByCode[codeKey] !== undefined ? countByCode[codeKey] : undefined) ??
        (nameKey && countByName[nameKey] !== undefined ? countByName[nameKey] : undefined) ??
        cat.productCount ??
        0;
      cat.productCount = directCount;
    }

    // Include sub-category products in parent category branch counts
    const getBranchCount = (cat: Category): number => {
      let total = cat.productCount ?? 0;
      if (cat.id) {
        const children = categories.filter(
          (c) => c.parentCategoryId && c.parentCategoryId.toLowerCase() === cat.id!.toLowerCase()
        );
        for (const ch of children) {
          total += getBranchCount(ch);
        }
      }
      return total;
    };

    return categories.map((cat) => ({
      ...cat,
      productCount: getBranchCount(cat),
    }));
  },

  /**
   * GET /api/v1/categories/{categoryId} and products in category
   */
  get: async (idOrCode: string): Promise<CategoryDetail> => {
    let category: Category | undefined;
    let categoryId = idOrCode;

    if (!isGuid(idOrCode)) {
      const all = await categoryApi.list(true);
      const found = all.find((c) => c.code.toLowerCase() === idOrCode.toLowerCase());
      if (found) {
        category = found;
        categoryId = found.id ?? idOrCode;
      }
    }

    let rawDetail: BackendCategoryDetail;
    try {
      rawDetail = await get<BackendCategoryDetail>(`/categories/${categoryId}`);
    } catch (e) {
      if (idOrCode !== categoryId) {
        rawDetail = await get<BackendCategoryDetail>(`/categories/${idOrCode}`);
      } else {
        throw e;
      }
    }

    const baseCat = category ? { ...category, ...mapCategory(rawDetail) } : mapCategory(rawDetail);

    if (Array.isArray(rawDetail.products)) {
      const mapped = rawDetail.products.map(mapProduct);
      return {
        ...baseCat,
        productCount: mapped.length,
        products: mapped,
      };
    }

    const targetGuid = [rawDetail?.id, baseCat.id, categoryId, idOrCode].find((v) => v && isGuid(v));

    try {
      let prods: BackendProduct[] = [];
      if (targetGuid) {
        try {
          const prodRes = await get<{ items?: BackendProduct[] } | BackendProduct[]>('/products', {
            categoryId: targetGuid,
            pageSize: 100,
          });
          prods = Array.isArray(prodRes) ? prodRes : (prodRes?.items ?? []);
        } catch {
          // If query with categoryId fails, fallback will handle it
        }
      }

      // If backend filtered products by categoryId didn't return any, fallback to all products matching category
      if (prods.length === 0) {
        const allProds = await fetchAllProductsForCount();
        const catCode = (rawDetail?.code || baseCat.code || '').toLowerCase();
        const catName = (rawDetail?.name || baseCat.name || '').toLowerCase().trim();
        const catGuid = (targetGuid || '').toLowerCase();
        const matched = allProds.filter((p) => {
          const pCatId = (p.productCategoryId || p.categoryId || '').toLowerCase();
          const pCode = (p.categoryCode || '').toLowerCase();
          const pName = (p.categoryName || '').toLowerCase().trim();
          return (
            (catGuid && pCatId === catGuid) ||
            (catCode && pCode === catCode) ||
            (catName && pName === catName)
          );
        });
        if (matched.length > 0) {
          prods = matched;
        }
      }

      const mappedProds = prods.map(mapProduct);
      return {
        ...baseCat,
        productCount: mappedProds.length,
        products: mappedProds,
      };
    } catch {
      return {
        ...baseCat,
        productCount: baseCat.productCount ?? 0,
        products: [],
      };
    }
  },

  /**
   * POST /api/v1/categories
   * Write: Admin
   */
  create: async (v: CategoryInput): Promise<Category> => {
    let code = v.code?.trim().toUpperCase();
    if (!code) {
      const existing = await categoryApi.list(true);
      const maxNum = existing.reduce((max, c) => {
        const m = c.code.match(/^CAT-(\d+)$/i);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);
      code = `CAT-${String(maxNum + 1).padStart(2, '0')}`;
    }

    const payload = {
      parentCategoryId: v.parentCategoryId || null,
      code,
      name: v.name.trim(),
      description: v.description?.trim() || null,
    };

    const res = await post<BackendCategory>('/categories', payload);
    const created = mapCategory(res);

    if (v.status === 'Inactive' && created.id) {
      try {
        await categoryApi.updateStatus(created.id, false);
        created.status = 'Inactive';
        created.isActive = false;
      } catch {
        // Continue even if status toggle failed
      }
    }

    return created;
  },

  /**
   * PUT /api/v1/categories/{categoryId}
   * Write: Admin
   */
  update: async (v: CategoryInput & { code?: string; id?: string }): Promise<Category> => {
    let id = v.id;
    if (!id && v.code) {
      const all = await categoryApi.list(true);
      const found = all.find((c) => c.code.toLowerCase() === v.code!.toLowerCase());
      id = found?.id;
    }
    const target = id || v.code!;

    const payload = {
      parentCategoryId: v.parentCategoryId || null,
      name: v.name.trim(),
      description: v.description?.trim() || null,
    };

    const res = await put<BackendCategory>(`/categories/${target}`, payload);
    const updated = mapCategory(res);

    if (v.status && id) {
      const shouldBeActive = v.status === 'Active';
      if (updated.isActive !== shouldBeActive) {
        try {
          await categoryApi.updateStatus(id, shouldBeActive);
          updated.status = v.status;
          updated.isActive = shouldBeActive;
        } catch {
          // ignore
        }
      }
    }

    return updated;
  },

  /**
   * PATCH /api/v1/categories/{categoryId}/status
   * Body: { isActive: boolean }
   * Write: Admin
   */
  updateStatus: async (idOrCode: string, isActive: boolean): Promise<void> => {
    let id = idOrCode;
    if (!isGuid(idOrCode)) {
      const all = await categoryApi.list(true);
      const found = all.find((c) => c.code.toLowerCase() === idOrCode.toLowerCase());
      if (found?.id) id = found.id;
    }
    await patch(`/categories/${id}/status`, { isActive });
  },
};

