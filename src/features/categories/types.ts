export interface Category {
  id?: string;
  parentCategoryId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  status: 'Active' | 'Inactive';
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
  /** Category default MLOR (0..1), null = inherit parent / system default. */
  defaultMlorRatio?: number | null;
  defaultMlorVersion?: number;
  defaultMlorUpdatedAt?: string | null;
}

export interface CategoryProduct {
  id?: string;
  sku: string;
  name: string;
  packSpec: string;
  basePrice: number;
  status: 'Draft' | 'Published' | 'Inactive' | string;
}

export interface CategoryDetail extends Category {
  products: CategoryProduct[];
}

export interface CategoryInput {
  id?: string;
  code?: string;
  parentCategoryId?: string | null;
  name: string;
  description?: string;
  status?: Category['status'];
  acknowledgeNonFmcgWarning?: boolean;
}

export interface FmcgCategoryEntry { name: string; description: string }
export interface FmcgCategoryCatalog { version: number; updatedAt: string | null; document: { categories: FmcgCategoryEntry[] } }
export interface FmcgCategoryEvaluation { isFmcgRelated: boolean; matchedCategories: string[]; catalogVersion: number }
export interface FmcgCategoryCatalogVersion { version: number; updatedAt: string; updatedByUserId: string | null; isActive: boolean }
