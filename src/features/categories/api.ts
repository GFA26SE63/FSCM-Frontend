import { getAll, http, post, put } from '@/shared/api/http';
import type { Category, CategoryDetail, CategoryInput } from './types';

interface ApiCategory { id: string; code: string; name: string; description?: string; isActive: boolean }
interface ApiProduct { productCategoryId: string; sku: string; name: string; unit: string; currentUnitPrice?: number; status: CategoryDetail['products'][number]['status'] }
const categoryRows = () => getAll<ApiCategory>('/categories', { includeInactive: true });
const products = () => getAll<ApiProduct>('/products');
const map = (row: ApiCategory, count: number): Category => ({ id: row.id, code: row.code, name: row.name, description: row.description ?? '', status: row.isActive ? 'Active' : 'Inactive', productCount: count });

export const categoryApi = {
  list: async () => {
    const [categories, productRows] = await Promise.all([categoryRows(), products()]);
    return categories.map((row) => map(row, productRows.filter((p) => p.productCategoryId === row.id).length));
  },
  get: async (code: string): Promise<CategoryDetail> => {
    const [categories, productRows] = await Promise.all([categoryRows(), products()]);
    const row = categories.find((c) => c.code === code);
    if (!row) throw new Error(`Không tìm thấy danh mục ${code}.`);
    return {
      ...map(row, productRows.filter((p) => p.productCategoryId === row.id).length),
      products: productRows.filter((p) => p.productCategoryId === row.id).map((p) => ({ sku: p.sku, name: p.name, packSpec: p.unit, basePrice: p.currentUnitPrice ?? 0, status: p.status })),
    };
  },
  create: (v: CategoryInput) => post<ApiCategory>('/categories', { name: v.name, description: v.description }),
  update: async (v: CategoryInput & { code: string }) => {
    const row = (await categoryRows()).find((c) => c.code === v.code);
    if (!row) throw new Error(`Không tìm thấy danh mục ${v.code}.`);
    const updated = await put<ApiCategory>(`/categories/${row.id}`, { parentCategoryId: null, name: v.name, description: v.description });
    if (updated.isActive !== (v.status === 'Active')) await http.patch(`/categories/${row.id}/status`, { isActive: v.status === 'Active' });
    return updated;
  },
};
