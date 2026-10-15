export type ProductStatus = 'Draft' | 'Published' | 'Inactive';
export interface Product {
  sku: string; name: string; categoryCode: string; categoryName: string; packSpec: string; basePrice: number;
  shelfLifeDays: number; nearExpiryDays: number; defaultMlor: number; status: ProductStatus;
}
export interface ProductBatch { warehouseCode: string; warehouseName: string; batchCode: string; expiry: string; available: number }
export interface ProductDetail extends Product { unitCost: number; replaceOf: string | null; replacedBy: string | null; batches: ProductBatch[] }
export interface ProductInput { name: string; categoryCode: string; packSpec: string; basePrice: number; unitCost: number; shelfLifeDays: number; nearExpiryDays: number; defaultMlor: number }
export interface CategoryOption { code: string; name: string; status: string }
