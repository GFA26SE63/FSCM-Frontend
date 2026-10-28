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
}
