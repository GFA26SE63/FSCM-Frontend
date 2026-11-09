export type RankingTab = 'sales' | 'products';
export type ProductCriterion = 'Quantity' | 'Revenue';

export interface ReportFilters {
  fromDate: string;
  toDate: string;
  salesGroupId: string;
  criterion: ProductCriterion;
}

export interface SalesGroupOption {
  id: string;
  code: string;
  name: string;
}

export interface SalesRankingEntry {
  rank: number;
  salesUserId: string;
  salesUserName: string;
  salesGroupId: string;
  salesGroupCode: string;
  salesGroupName: string;
  regionId: string;
  orderCount: number;
  recognizedRevenue: number;
}

export interface SalesRankingResponse {
  fromDate: string;
  toDate: string;
  scope: string;
  entries: SalesRankingEntry[];
}

export interface ProductRankingEntry {
  rank: number;
  productId: string;
  sku: string;
  productName: string;
  normalizedSoldQuantity: number;
  quantityUnit: string;
  adjustedNetRevenue: number;
}

export interface ProductRankingResponse {
  fromDate: string;
  toDate: string;
  criterion: ProductCriterion;
  scope: string;
  quantityUnit: string;
  recognitionRule: string;
  entries: ProductRankingEntry[];
}