import { get, getAll, post, put } from '@/shared/api/http';
import type { AreaOption, GroupOption, LoyaltyBalance, MlorRow, Registration, Retailer, RetailerInput, RetailerReceivable } from './types';

export const retailerApi = {
  list: () => getAll<Retailer>('/retailers'),
  get: (code: string) => get<Retailer>(`/retailers/${code}`),
  create: (v: RetailerInput) => post<Retailer>('/retailers', v),
  update: (v: RetailerInput & { code: string }) => put<Retailer>(`/retailers/${v.code}`, v),
  registrations: () => getAll<Registration>('/retailer-registrations'),
  registration: (code: string) => get<Registration>(`/retailer-registrations/${code}`),
  approve: (code: string) => post<{ registration: Registration; retailer: Retailer }>(`/retailer-registrations/${code}/approve`),
  reject: (v: { code: string; reason: string }) => post<Registration>(`/retailer-registrations/${v.code}/reject`, { reason: v.reason }),
  mlor: (code: string) => get<MlorRow[]>(`/retailers/${code}/mlor`),
  saveMlor: (v: { code: string; items: { sku: string; mlor: number }[] }) => put(`/retailers/${v.code}/mlor`, { items: v.items }),
  areas: () => getAll<AreaOption>('/areas'),
  groups: () => getAll<GroupOption>('/sales-groups'),
  receivables: (code: string) => getAll<RetailerReceivable>('/receivables', { retailerCode: code }),
  loyalty: (code: string) => get<LoyaltyBalance>(`/loyalty/retailers/${code}`),
};
