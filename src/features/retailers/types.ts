export interface Retailer {
  code: string; name: string; address: string; phone: string; contact: string; areaCode: string; areaName: string; groupCode: string;
  lat: number; lng: number; status: 'Active' | 'Locked'; source: string; kind: string; size: 'S' | 'M' | 'L'; areaM2: number; fridges: number;
  forecastRevenue: number; monthlyCapacity: number; orderFrequency: string; potentialClass: 'A' | 'B' | 'C'; creditTermDays: 0 | 7 | 14 | 30;
}
export interface Registration {
  code: string; name: string; address: string; phone: string; contact: string; areaCode: string; areaName: string; kind: string; size: 'S' | 'M' | 'L';
  forecastRevenue: number; monthlyCapacity: number; salesName: string; createdAt: string; status: 'Pending' | 'Approved' | 'Rejected';
  retailerCode: string | null; rejectReason: string | null; potentialClass: 'A' | 'B' | 'C';
}
/** Unified list row: a retailer, or a Sales registration (KB-xxxx) still waiting for / rejected by review. */
export interface RetailerRow {
  code: string; name: string; address: string; areaName: string; contact: string; phone: string; kind: 'Retailer' | 'Registration';
  status: string; statusDomain: 'active' | 'registration'; potentialClass: 'A' | 'B' | 'C'; source: string;
}
export interface MlorRow { sku: string; productName: string; shelfLifeDays: number; defaultMlor: number; mlor: number; overridden: boolean }
export interface RetailerInput extends Partial<Omit<Retailer, 'areaName' | 'potentialClass' | 'source'>> { code?: string }
export interface AreaOption { code: string; name: string }
export interface GroupOption { code: string; areaCode: string }
export interface RetailerReceivable { orderCode: string; total: number; outstanding: number; dueDate: string; status: 'Unpaid' | 'Paid' | 'Overdue' }
export interface LoyaltyBalance { retailerCode: string; balance: number; held: number; available: number }
