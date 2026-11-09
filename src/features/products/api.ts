import { del, getAll, post, put } from '@/shared/api/http';
import type { CategoryOption, Product, ProductDetail, ProductInput } from './types';

interface ApiProduct {
  id: string; productCategoryId: string; categoryCode: string; categoryName: string; replacesProductId?: string;
  sku: string; name: string; unit: string; shelfLifeHours: number; nearDateThresholdHours: number;
  status: Product['status']; currentUnitPrice?: number;
}
interface ApiCategory { code: string; name: string; isActive: boolean }
interface ApiInventory { productId: string; warehouseCode: string; warehouseName: string; batchCode: string; expirationDate: string; availableQuantity: number }

const rows = () => getAll<ApiProduct>('/products');
const mapProduct = (p: ApiProduct): Product => ({
  id: p.id,
  sku: p.sku,
  name: p.name,
  categoryCode: p.categoryCode,
  categoryName: p.categoryName,
  packSpec: p.unit,
  basePrice: p.currentUnitPrice ?? 0,
  shelfLifeDays: Math.round(p.shelfLifeHours / 24),
  nearExpiryDays: Math.round(p.nearDateThresholdHours / 24),
  defaultMlor: 0.25,
  status: p.status,
});
const requireBySku = async (sku: string) => {
  const row = (await rows()).find((p) => p.sku === sku);
  if (!row) throw new Error(`Không tìm thấy SKU ${sku}.`);
  return row;
};
const categoryId = async (code: string) => {
  const category = (await getAll<{ id: string; code: string }>('/categories')).find((c) => c.code === code);
  if (!category) throw new Error('Danh mục sản phẩm không hợp lệ.');
  return category.id;
};

export const productApi = {
  list: async () => (await rows()).map(mapProduct),
  get: async (sku: string): Promise<ProductDetail> => {
    const raw = await requireBySku(sku);
    const inventory = await getAll<ApiInventory>('/inventory', { productId: raw.id, includeExpired: true });
    return { ...mapProduct(raw), unitCost: raw.currentUnitPrice ?? 0, replaceOf: null, replacedBy: null, batches: inventory.map((b) => ({ warehouseCode: b.warehouseCode, warehouseName: b.warehouseName, batchCode: b.batchCode, expiry: b.expirationDate, available: b.availableQuantity })) };
  },
  create: async (v: ProductInput) => post<ApiProduct>('/products', { productCategoryId: await categoryId(v.categoryCode), sku: v.sku, name: v.name, unit: v.packSpec, shelfLifeHours: v.shelfLifeDays * 24, nearDateThresholdHours: v.nearExpiryDays * 24, initialUnitPrice: v.basePrice }).then(mapProduct),
  update: async (v: ProductInput & { sku: string }) => {
    const raw = await requireBySku(v.sku);
    const updated = await put<ApiProduct>(`/products/${raw.id}`, { productCategoryId: await categoryId(v.categoryCode), name: v.name, unit: v.packSpec, shelfLifeHours: v.shelfLifeDays * 24, nearDateThresholdHours: v.nearExpiryDays * 24 });
    if (v.basePrice > 0 && v.basePrice !== (raw.currentUnitPrice ?? 0)) await post(`/products/${raw.id}/prices`, { unitPrice: v.basePrice });
    return mapProduct(updated);
  },
  remove: async (sku: string) => del(`/products/${(await requireBySku(sku)).id}`),
  publish: async (sku: string) => mapProduct(await post<ApiProduct>(`/products/${(await requireBySku(sku)).id}/publish`)),
  inactivate: async (sku: string) => {
    const raw = await requireBySku(sku);
    await post(`/products/${raw.id}/inactivate`);
    return mapProduct({ ...raw, status: 'Inactive' });
  },
  /** "Tạo bản mới": copy into a Draft that replaces the published/inactive SKU once published. */
  clone: async (sku: string) => {
    const [source, all] = await Promise.all([requireBySku(sku), rows()]);
    const next = Math.max(0, ...all.map((p) => Number(p.sku.replace(/^SKU/, '')) || 0)) + 1;
    return mapProduct(await post<ApiProduct>(`/products/${source.id}/clone`, { sku: `SKU${String(next).padStart(3, '0')}` }));
  },
  categories: async (): Promise<CategoryOption[]> => (await getAll<ApiCategory>('/categories', { includeInactive: true })).map((c) => ({ code: c.code, name: c.name, status: c.isActive ? 'Active' : 'Inactive' })),
};
