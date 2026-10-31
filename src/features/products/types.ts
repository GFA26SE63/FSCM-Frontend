export type ProductStatus = 'Draft' | 'Published' | 'Inactive';

export interface Product {
  id: string;
  productCategoryId: string;
  categoryCode: string;
  categoryName: string;
  replacesProductId: string | null;
  sku: string;
  name: string;
  unit: string;
  shelfLifeHours: number;
  nearDateThresholdHours: number;
  status: ProductStatus;
  currentUnitPrice: number | null;
  publishedAt: string | null;
  inactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFields {
  productCategoryId: string;
  name: string;
  unit: string;
  shelfLifeHours: number;
  nearDateThresholdHours: number;
}

export interface CreateProductInput extends ProductFields {
  sku: string;
  initialUnitPrice: number;
}

export interface CategoryOption {
  id: string;
  parentCategoryId: string | null;
  code: string;
  name: string;
  isActive: boolean;
}

export interface ProductPage {
  items: Product[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ProductPrice {
  id: string;
  productId: string;
  unitPrice: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
}