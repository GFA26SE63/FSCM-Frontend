import { get, getAll, post, put } from '@/shared/api/http';
import type { AreaOption, GroupOption, LoyaltyBalance, MlorRow, Registration, Retailer, RetailerInput, RetailerReceivable } from './types';

interface ApiRetailer {
  id: string; regionId: string; salesGroupId: string; salesGroupCode: string; code: string; name: string;
  contactName?: string; phone?: string; address?: string; latitude?: number; longitude?: number; status: string;
  retailerType: string; forecastRevenue: number; storeSizeSquareMeters: number; storeSizeCategory: 'S' | 'M' | 'L';
  purchasingCapacity: number; purchaseFrequencyPerMonth: number; creditTermDays: number; potentialClass: 'A' | 'B' | 'C';
  assessmentNote?: string; createdAt: string; reviewReason?: string;
  mlorDeclarations?: { productSku?: string; productName?: string; minimumLifeRatio: number; scope: string }[];
}
interface ApiRegion { id: string; code: string; name: string }
interface ApiGroup { id: string; code: string; regionCode: string }
interface ApiProduct { id: string; sku: string; name: string; shelfLifeHours: number }
interface ApiMlor { productId?: string; productSku?: string; productName?: string; minimumLifeRatio: number }
interface ApiPayment { retailerCode: string; orderCode: string; amount: number; outstandingAmount: number; dueDate?: string; status: string }
interface ApiCard { availablePoints: number; heldPoints: number; pendingPoints: number }

const rawRows = () => getAll<ApiRetailer>('/retailers');
const regionRows = () => getAll<ApiRegion>('/regions');
const mapRetailer = (row: ApiRetailer, regions: ApiRegion[]): Retailer => ({
  id: row.id,
  code: row.code,
  name: row.name,
  address: row.address ?? '',
  phone: row.phone ?? '',
  contact: row.contactName ?? '',
  areaCode: regions.find((r) => r.id === row.regionId)?.code ?? '',
  areaName: regions.find((r) => r.id === row.regionId)?.name ?? '',
  groupCode: row.salesGroupCode,
  lat: row.latitude ?? 0,
  lng: row.longitude ?? 0,
  status: row.status === 'Active' ? 'Active' : 'Locked',
  source: 'Sales khai báo',
  kind: row.retailerType,
  size: row.storeSizeCategory,
  areaM2: row.storeSizeSquareMeters,
  fridges: 0,
  forecastRevenue: row.forecastRevenue,
  monthlyCapacity: row.purchasingCapacity,
  orderFrequency: `${row.purchaseFrequencyPerMonth} lần / tháng`,
  potentialClass: row.potentialClass,
  creditTermDays: ([0, 7, 14, 30].includes(row.creditTermDays) ? row.creditTermDays : 0) as 0 | 7 | 14 | 30,
});
const registration = (row: ApiRetailer, regions: ApiRegion[]): Registration => ({
  code: row.code,
  name: row.name,
  address: row.address ?? '',
  phone: row.phone ?? '',
  contact: row.contactName ?? '',
  areaCode: regions.find((r) => r.id === row.regionId)?.code ?? '',
  areaName: regions.find((r) => r.id === row.regionId)?.name ?? '',
  kind: row.retailerType,
  size: row.storeSizeCategory,
  forecastRevenue: row.forecastRevenue,
  monthlyCapacity: row.purchasingCapacity,
  salesName: 'Sales phụ trách',
  createdAt: row.createdAt,
  status: row.status === 'Rejected' ? 'Rejected' : row.status === 'Active' ? 'Approved' : 'Pending',
  retailerCode: row.status === 'Active' ? row.code : null,
  rejectReason: row.reviewReason ?? null,
  potentialClass: row.potentialClass,
});

export const retailerApi = {
  list: async () => {
    const [rows, regions] = await Promise.all([rawRows(), regionRows()]);
    return rows.filter((r) => !['PendingApproval', 'Rejected'].includes(r.status)).map((r) => mapRetailer(r, regions));
  },
  get: async (code: string) => {
    const [rows, regions] = await Promise.all([rawRows(), regionRows()]);
    const summary = rows.find((r) => r.code === code);
    if (!summary) throw new Error(`Không tìm thấy retailer ${code}.`);
    return mapRetailer(await get<ApiRetailer>(`/retailers/${summary.id}`), regions);
  },
  create: (v: RetailerInput) => post<Retailer>('/retailers', v),
  update: (v: RetailerInput & { code: string }) => put<Retailer>(`/retailers/${v.code}`, v),
  registrations: async () => {
    const [rows, regions] = await Promise.all([rawRows(), regionRows()]);
    return rows.filter((r) => ['PendingApproval', 'Rejected'].includes(r.status)).map((r) => registration(r, regions));
  },
  registration: async (code: string) => {
    const [rows, regions] = await Promise.all([rawRows(), regionRows()]);
    const row = rows.find((r) => r.code === code);
    if (!row) throw new Error(`Không tìm thấy khai báo ${code}.`);
    return registration(row, regions);
  },
  approve: async (code: string) => {
    const [rows, regions] = await Promise.all([rawRows(), regionRows()]);
    const row = rows.find((r) => r.code === code);
    if (!row) throw new Error(`Không tìm thấy khai báo ${code}.`);
    const approved = await post<ApiRetailer>(`/retailers/${row.id}/review`, { approve: true, creditTermDays: row.creditTermDays, reason: 'Thông tin hợp lệ.' });
    return { registration: registration(approved, regions), retailer: mapRetailer(approved, regions) };
  },
  reject: async (v: { code: string; reason: string }) => {
    const [rows, regions] = await Promise.all([rawRows(), regionRows()]);
    const row = rows.find((r) => r.code === v.code);
    if (!row) throw new Error(`Không tìm thấy khai báo ${v.code}.`);
    return registration(await post<ApiRetailer>(`/retailers/${row.id}/review`, { approve: false, creditTermDays: null, reason: v.reason }), regions);
  },
  mlor: async (code: string): Promise<MlorRow[]> => {
    const retailer = (await rawRows()).find((r) => r.code === code);
    if (!retailer) throw new Error(`Không tìm thấy retailer ${code}.`);
    const [products, rules] = await Promise.all([getAll<ApiProduct>('/products'), getAll<ApiMlor>('/mlor-configurations', { retailerId: retailer.id })]);
    return products.map((p) => {
      const rule = rules.find((r) => r.productId === p.id || r.productSku === p.sku);
      return { sku: p.sku, productName: p.name, shelfLifeDays: Math.round(p.shelfLifeHours / 24), defaultMlor: 0.25, mlor: rule?.minimumLifeRatio ?? 0.25, overridden: !!rule };
    });
  },
  saveMlor: async (v: { code: string; items: { sku: string; mlor: number }[] }) => {
    const retailer = (await rawRows()).find((r) => r.code === v.code);
    const products = await getAll<ApiProduct>('/products');
    if (!retailer) throw new Error(`Không tìm thấy retailer ${v.code}.`);
    await Promise.all(v.items.map((item) => {
      const product = products.find((p) => p.sku === item.sku);
      if (!product) throw new Error(`Không tìm thấy SKU ${item.sku}.`);
      return post('/mlor-configurations', { retailerId: retailer.id, productCategoryId: null, productId: product.id, minimumLifeRatio: item.mlor, minimumLifeHours: null });
    }));
  },
  areas: async (): Promise<AreaOption[]> => (await regionRows()).map((r) => ({ code: r.code, name: r.name })),
  groups: async (): Promise<GroupOption[]> => (await getAll<ApiGroup>('/sales-groups')).map((g) => ({ code: g.code, areaCode: g.regionCode })),
  receivables: async (code: string): Promise<RetailerReceivable[]> => (await getAll<ApiPayment>('/receivables')).filter((p) => p.retailerCode === code).map((p) => ({ orderCode: p.orderCode, total: p.amount, outstanding: p.outstandingAmount, dueDate: p.dueDate ?? '', status: p.status === 'Paid' ? 'Paid' : p.status === 'Overdue' ? 'Overdue' : 'Unpaid' })),
  loyalty: async (code: string): Promise<LoyaltyBalance> => {
    const card = await get<ApiCard>(`/loyalty/cards/by-code/${code}`);
    return { retailerCode: code, balance: card.availablePoints + card.heldPoints + card.pendingPoints, held: card.heldPoints, available: card.availablePoints };
  },
};
