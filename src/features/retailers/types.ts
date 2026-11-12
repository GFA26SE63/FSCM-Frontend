export interface Retailer {
  id?: string;
  code: string;
  name: string;
  contactName?: string | null;
  contact: string;
  phone: string;
  email?: string | null;
  address: string;
  areaCode: string;
  areaName: string;
  regionId?: string | null;
  salesGroupId?: string | null;
  salesGroupCode?: string | null;
  groupCode: string;
  lat: number;
  lng: number;
  latitude?: number | null;
  longitude?: number | null;
  locationVersion?: number;
  status: 'Draft' | 'PendingApproval' | 'Active' | 'Rejected' | 'Inactive' | 'Locked' | string;
  source: string;
  retailerType?: string;
  kind: string;
  size: 'S' | 'M' | 'L' | string;
  storeSizeCategory?: string | null;
  storeSizeSquareMeters?: number;
  areaM2: number;
  fridges: number;
  forecastRevenue: number;
  monthlyCapacity: number;
  purchasingCapacity?: number;
  orderFrequency: string;
  purchaseFrequencyPerMonth?: number;
  potentialClass: 'A' | 'B' | 'C' | string;
  assessmentNote?: string | null;
  creditTermDays: 0 | 7 | 14 | 30 | number;
  requestedCreditTermDays?: number | null;
  declaredByUserId?: string;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  reviewReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  storefrontImageUrl?: string | null;
  canSubmitForReview?: boolean;
  mlorDeclarations?: RetailerMlorDeclarationResult[];
}
export interface Registration {
  code: string; name: string; address: string; phone: string; contact: string; areaCode: string; areaName: string; kind: string; size: 'S' | 'M' | 'L';
  forecastRevenue: number; monthlyCapacity: number; salesName: string; createdAt: string; status: 'Pending' | 'Approved' | 'Rejected';
  retailerCode: string | null; rejectReason: string | null; potentialClass: 'A' | 'B' | 'C';
}
/** Unified list row: a retailer, or a Sales registration (KB-xxxx) still waiting for / rejected by review. */
export interface RetailerRow {
  code: string; name: string; address: string; areaName: string; contact: string; phone: string; kind: 'Retailer' | 'Registration';
  status: string; statusDomain: 'active' | 'registration'; potentialClass: 'A' | 'B' | 'C' | string; source: string;
}
export interface MlorRow { sku: string; productName: string; shelfLifeDays: number; defaultMlor: number; mlor: number; overridden: boolean }
export interface RetailerInput extends Partial<Omit<Retailer, 'areaName' | 'potentialClass' | 'source'>> { code?: string }
export interface AreaOption { id?: string; code: string; name: string }
export interface GroupOption { id?: string; code: string; name?: string; areaCode: string; regionId?: string }
export interface RetailerReceivable {
  orderId?: string;
  orderCode: string;
  retailerId?: string;
  retailerCode?: string | null;
  retailerName?: string | null;
  total?: number;
  adjustedAmount?: number;
  outstanding?: number;
  outstandingAmount?: number;
  creditTermDays?: number;
  deliveredDate?: string | null;
  dueDate: string | null;
  status: 'Unpaid' | 'Paid' | 'Overdue' | string;
}
export interface LoyaltyBalance {
  retailerCode?: string | null;
  retailerId?: string;
  programId?: string | null;
  programCode?: string | null;
  programName?: string | null;
  availablePoints?: number;
  heldPoints?: number;
  pendingPoints?: number;
  expiredPoints?: number;
  pointsExpireAt?: string | null;
  balance?: number;
  held?: number;
  available?: number;
}

export interface RetailerOrderEligibility {
  salesUserId?: string;
  retailerId: string;
  isEligible: boolean;
  salesGroupId?: string | null;
  salesGroupCode?: string | null;
  retailerStatus?: string | null;
  creditTermDays: number;
  reasons?: string[] | null;
}

export interface ReviewCreditTermsInput {
  retailerId: string;
  creditTermDays: 0 | 7 | 14 | 30;
  reason?: string;
}

export interface RetailerMlorDeclarationResult {
  id?: string;
  retailerId?: string;
  scope: string; // 'RetailerProduct' | 'RetailerCategory'
  productCategoryId?: string | null;
  categoryCode?: string | null;
  categoryName?: string | null;
  productId?: string | null;
  productSku?: string | null;
  productName?: string | null;
  minimumLifeRatio: number;
  minimumLifeHours?: number | null;
  version?: number;
  updatedByUserId?: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
}

export interface MlorConfigItem {
  id: string;
  retailerId: string;
  retailerCode?: string | null;
  retailerName?: string | null;
  productCategoryId?: string | null;
  categoryCode?: string | null;
  categoryName?: string | null;
  productId?: string | null;
  productSku?: string | null;
  productName?: string | null;
  minimumLifeRatio: number;
  minimumLifeHours?: number | null;
  version: number;
  updatedByUserId?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
}

export interface SetMlorPayload {
  retailerId: string;
  productCategoryId?: string | null;
  productId?: string | null;
  minimumLifeRatio: number;
  minimumLifeHours?: number | null;
}

export interface RetailerMlorResolution {
  retailerId: string;
  productId: string;
  sourceScope: string | null; // 'RetailerProduct' | 'RetailerCategory' | 'ProductDefault'
  sourceRuleId?: string | null;
  sourceVersion?: number;
  productCategoryId?: string | null;
  minimumLifeRatio: number;
  minimumLifeHours?: number | null;
  resolvedAt?: string;
}

export interface UpdateRetailerDeclarationPayload {
  name?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  retailerType?: string;
  forecastRevenue?: number;
  storeSizeSquareMeters?: number;
  purchasingCapacity?: number;
  purchaseFrequencyPerMonth?: number;
  requestedCreditTermDays?: number;
  assessmentNote?: string;
  latitude?: number;
  longitude?: number;
  providerPlaceId?: string;
  mlorDeclarations?: {
    productCategoryId?: string | null;
    productId?: string | null;
    minimumLifeRatio: number;
    minimumLifeHours?: number | null;
  }[];
  submitForReview?: boolean;
}

/** Admin profile edits never submit a declaration or replace its MLOR rules. */
export type UpdateRetailerProfilePayload = Omit<UpdateRetailerDeclarationPayload, 'mlorDeclarations' | 'submitForReview'>;

export interface RetailerPage {
  items: Retailer[];
  totalCount: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}
