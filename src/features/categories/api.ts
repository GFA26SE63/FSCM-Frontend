import { del, get, patch, post, put } from "@/shared/api/http";
import type {
  Category,
  CategoryDetail,
  CategoryInput,
  CategoryProduct,
  FmcgCategoryCatalog,
  FmcgCategoryCatalogVersion,
  FmcgCategoryEvaluation,
} from "./types";
import {
  fetchCategoriesGraphql,
  fetchCurrentProductPricesGraphql,
  fetchProductsByCategoryIdsGraphql,
  type GraphProduct,
} from "./categoriesGraphql";

interface BackendCategory {
  id: string;
  parentCategoryId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  status?: "Active" | "Inactive";
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
  defaultMlorRatio?: number | null;
  defaultMlorVersion?: number;
  defaultMlorUpdatedAt?: string | null;
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
  const active = raw.isActive ?? raw.status !== "Inactive";
  return {
    id: raw.id,
    parentCategoryId: raw.parentCategoryId ?? null,
    code: raw.code,
    name: raw.name,
    description: raw.description ?? "",
    isActive: active,
    status: active ? "Active" : "Inactive",
    productCount: raw.productCount ?? 0,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    defaultMlorRatio: raw.defaultMlorRatio ?? null,
    defaultMlorVersion: raw.defaultMlorVersion ?? 0,
    defaultMlorUpdatedAt: raw.defaultMlorUpdatedAt ?? null,
  };
};

const mapProduct = (p: BackendProduct): CategoryProduct => ({
  id: p.id,
  sku: p.sku,
  name: p.name,
  packSpec: p.packSpec || p.unit || "—",
  basePrice: p.currentUnitPrice ?? p.basePrice ?? 0,
  status: p.status ?? "Draft",
});

const isGuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

const mapGraphProduct = (product: GraphProduct): BackendProduct => ({
  id: product.id,
  productCategoryId: product.productCategoryId,
  sku: product.sku,
  name: product.name,
  unit: product.unit,
  status: product.status,
});

export const categoryApi = {
  /**
   * GET /api/v1/categories?includeInactive=true
   * Read: all authenticated users
   */
  list: async (includeInactive = true): Promise<Category[]> => {
    const list = (await fetchCategoriesGraphql()) as BackendCategory[];
    const allProducts = (
      await fetchProductsByCategoryIdsGraphql(
        list.map((category) => category.id),
      )
    ).map(mapGraphProduct);
    const visible = includeInactive
      ? list
      : list.filter((category) => category.isActive !== false);

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

    const categories = visible.map(mapCategory);

    // Assign direct product count first
    for (const cat of categories) {
      const idKey = cat.id?.toLowerCase();
      const codeKey = cat.code?.toLowerCase();
      const nameKey = cat.name?.toLowerCase().trim();
      const directCount =
        (idKey && countById[idKey] !== undefined
          ? countById[idKey]
          : undefined) ??
        (codeKey && countByCode[codeKey] !== undefined
          ? countByCode[codeKey]
          : undefined) ??
        (nameKey && countByName[nameKey] !== undefined
          ? countByName[nameKey]
          : undefined) ??
        cat.productCount ??
        0;
      cat.productCount = directCount;
    }

    // Include sub-category products in parent category branch counts
    const getBranchCount = (cat: Category): number => {
      let total = cat.productCount ?? 0;
      if (cat.id) {
        const children = categories.filter(
          (c) =>
            c.parentCategoryId &&
            c.parentCategoryId.toLowerCase() === cat.id!.toLowerCase(),
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
    const categories = (await fetchCategoriesGraphql()).map(mapCategory);
    const baseCat = categories.find(
      (category) =>
        category.id?.toLowerCase() === idOrCode.toLowerCase() ||
        category.code.toLowerCase() === idOrCode.toLowerCase(),
    );
    if (!baseCat) throw new Error("Không tìm thấy danh mục.");
    const branchIds = new Set<string>([baseCat.id!.toLowerCase()]);
    let foundChild = true;
    while (foundChild) {
      foundChild = false;
      for (const category of categories) {
        if (
          category.parentCategoryId &&
          branchIds.has(category.parentCategoryId.toLowerCase()) &&
          category.id &&
          !branchIds.has(category.id.toLowerCase())
        ) {
          branchIds.add(category.id.toLowerCase());
          foundChild = true;
        }
      }
    }
    const branchProducts = await fetchProductsByCategoryIdsGraphql([
      ...branchIds,
    ]);
    const prices = await fetchCurrentProductPricesGraphql(
      branchProducts.map((product) => product.id),
    );
    const products = branchProducts
      .map(mapGraphProduct)
      .map((product) => ({
        ...product,
        currentUnitPrice: prices.get(product.id),
      }))
      .map(mapProduct);
    return { ...baseCat, productCount: products.length, products };
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
      code = `CAT-${String(maxNum + 1).padStart(2, "0")}`;
    }

    const payload = {
      parentCategoryId: v.parentCategoryId || null,
      code,
      name: v.name.trim(),
      description: v.description?.trim() || null,
      acknowledgeNonFmcgWarning: v.acknowledgeNonFmcgWarning ?? false,
    };

    const res = await post<BackendCategory>("/categories", payload);
    const created = mapCategory(res);

    if (v.status === "Inactive" && created.id) {
      try {
        await categoryApi.updateStatus(created.id, false);
        created.status = "Inactive";
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
  update: async (
    v: CategoryInput & { code?: string; id?: string },
  ): Promise<Category> => {
    let id = v.id;
    if (!id && v.code) {
      const all = await categoryApi.list(true);
      const found = all.find(
        (c) => c.code.toLowerCase() === v.code!.toLowerCase(),
      );
      id = found?.id;
    }
    const target = id || v.code!;

    const payload = {
      parentCategoryId: v.parentCategoryId || null,
      name: v.name.trim(),
      description: v.description?.trim() || null,
      acknowledgeNonFmcgWarning: v.acknowledgeNonFmcgWarning ?? false,
    };

    const res = await put<BackendCategory>(`/categories/${target}`, payload);
    const updated = mapCategory(res);

    if (v.status && id) {
      const shouldBeActive = v.status === "Active";
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

  getFmcgCatalog: () => get<FmcgCategoryCatalog>("/fmcg-category-catalog"),
  getFmcgCatalogHistory: () =>
    get<FmcgCategoryCatalogVersion[]>("/fmcg-category-catalog/history"),
  saveFmcgCatalog: (document: {
    categories: Array<{ name: string; description: string }>;
  }) => put<FmcgCategoryCatalogVersion>("/fmcg-category-catalog", document),
  evaluateFmcgCategory: (name: string, description?: string) =>
    post<FmcgCategoryEvaluation>("/fmcg-category-catalog/evaluate", {
      name,
      description: description || null,
    }),

  /**
   * PATCH /api/v1/categories/{categoryId}/status
   * Body: { isActive: boolean }
   * Write: Admin
   */
  updateStatus: async (idOrCode: string, isActive: boolean): Promise<void> => {
    let id = idOrCode;
    if (!isGuid(idOrCode)) {
      const all = await categoryApi.list(true);
      const found = all.find(
        (c) => c.code.toLowerCase() === idOrCode.toLowerCase(),
      );
      if (found?.id) id = found.id;
    }
    await patch(`/categories/${id}/status`, { isActive });
  },

  /**
   * DELETE /api/v1/categories/{categoryId}
   */
  delete: async (
    idOrCode: string,
  ): Promise<{
    categoryId: string;
    deleted: boolean;
    inactivated: boolean;
  }> => {
    let id = idOrCode;
    if (!isGuid(idOrCode)) {
      const all = await categoryApi.list(true);
      const found = all.find(
        (c) => c.code.toLowerCase() === idOrCode.toLowerCase(),
      );
      if (found?.id) id = found.id;
    }
    return del<{ categoryId: string; deleted: boolean; inactivated: boolean }>(
      `/categories/${id}`,
    );
  },
  /**
   * PUT /api/v1/categories/{categoryId}/default-mlor
   * Body: { minimumLifeRatio: number | null } (null clears the category default)
   * Write: Admin
   */
  setDefaultMlor: async (
    id: string,
    minimumLifeRatio: number | null,
  ): Promise<Category> =>
    mapCategory(
      await put<BackendCategory>(`/categories/${id}/default-mlor`, {
        minimumLifeRatio,
      }),
    ),
};
