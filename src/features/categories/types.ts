export interface Category { code: string; name: string; description: string; status: 'Active' | 'Inactive'; productCount: number }
export interface CategoryProduct { sku: string; name: string; packSpec: string; basePrice: number; status: 'Draft' | 'Published' | 'Inactive' }
export interface CategoryDetail extends Category { products: CategoryProduct[] }
export interface CategoryInput { name: string; description: string; status: Category['status'] }
