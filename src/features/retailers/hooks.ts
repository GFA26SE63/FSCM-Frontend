import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { retailerApi } from './api';
import type { RetailerRow } from './types';

/** Retailers + pending/rejected registrations merged into one list (Approved registrations already exist as retailers). */
export const useRetailerRows = () =>
  useQuery({
    queryKey: ['retailers', 'rows'],
    queryFn: async (): Promise<RetailerRow[]> => {
      const [retailers, regs] = await Promise.all([retailerApi.list(), retailerApi.registrations()]);
      const regRows: RetailerRow[] = regs
        .filter((x) => x.status !== 'Approved')
        .map((x) => ({ code: x.code, name: x.name, address: x.address, areaName: x.areaName, contact: x.contact, phone: x.phone, kind: 'Registration', status: x.status, statusDomain: 'registration', potentialClass: x.potentialClass, source: `Sales ${x.salesName} khai báo` }));
      const rows: RetailerRow[] = retailers.map((r) => ({ code: r.code, name: r.name, address: r.address, areaName: r.areaName, contact: r.contact, phone: r.phone, kind: 'Retailer', status: r.status, statusDomain: 'active', potentialClass: r.potentialClass, source: r.source }));
      return [...regRows, ...rows];
    },
  });
export const useRetailer = (code: string, enabled = true) => useQuery({ queryKey: ['retailers', 'detail', code], queryFn: () => retailerApi.get(code), enabled });
export const useRegistration = (code: string, enabled = true) => useQuery({ queryKey: ['retailers', 'registration', code], queryFn: () => retailerApi.registration(code), enabled });
export const useRetailerMlor = (code: string, enabled = true) => useQuery({ queryKey: ['retailers', 'mlor', code], queryFn: () => retailerApi.mlor(code), enabled });
export const useRetailerReceivables = (code: string, enabled = true) => useQuery({ queryKey: ['retailers', 'receivables', code], queryFn: () => retailerApi.receivables(code), enabled });
export const useRetailerLoyalty = (code: string, enabled = true) => useQuery({ queryKey: ['retailers', 'loyalty', code], queryFn: () => retailerApi.loyalty(code), enabled });
export const useRetailerLookups = (enabled = true) => ({
  areas: useQuery({ queryKey: ['retailers', 'areas'], queryFn: retailerApi.areas, enabled }),
  groups: useQuery({ queryKey: ['retailers', 'groups'], queryFn: retailerApi.groups, enabled }),
});
export const useCreateRetailer = () => useApiMutation(retailerApi.create, { permission: 'retailers.create', success: (r) => `Đã tạo retailer ${r.code} · ${r.name}.` });
export const useUpdateRetailer = () => useApiMutation(retailerApi.update, { permission: 'retailers.edit', success: (r) => `Đã cập nhật retailer ${r.code}.` });
export const useApproveRegistration = () => useApiMutation(retailerApi.approve, { permission: 'retailers.review', success: (r) => `Đã duyệt ${r.registration.code}: cấp mã điểm bán ${r.retailer.code} và báo Sales.` });
export const useRejectRegistration = () => useApiMutation(retailerApi.reject, { permission: 'retailers.review', success: (r) => `Đã từ chối ${r.code}.` });
export const useSaveMlor = () => useApiMutation(retailerApi.saveMlor, { permission: 'mlor.manage', success: 'Đã lưu MLOR của retailer.' });
