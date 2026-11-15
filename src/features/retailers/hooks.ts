import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { retailerApi } from './api';
import type { RetailerRow, SetMlorPayload, UpdateRetailerDeclarationPayload, UpdateRetailerProfilePayload } from './types';

/** Retailers + pending/rejected registrations merged into one list (Approved registrations already exist as retailers). */
export const useRetailerRows = () =>
  useQuery({
    queryKey: ['retailers', 'rows'],
    queryFn: async (): Promise<RetailerRow[]> => {
      const [retailers, regs] = await Promise.all([retailerApi.listAll(), retailerApi.registrations()]);
      const regRows: RetailerRow[] = regs
        .filter((x) => x.status !== 'Approved')
        .map((x) => ({ code: x.code, name: x.name, address: x.address, areaName: x.areaName, contact: x.contact, phone: x.phone, kind: 'Registration', status: x.status, statusDomain: 'registration', potentialClass: x.potentialClass, source: `Sales ${x.salesName} khai báo` }));
      const rows: RetailerRow[] = retailers.map((r) => ({ code: r.code, name: r.name, address: r.address, areaName: r.areaName, contact: r.contact, phone: r.phone, kind: 'Retailer', status: r.status, statusDomain: 'active', potentialClass: r.potentialClass, source: r.source }));
      return [...regRows, ...rows];
    },
  });
export const useRetailer = (identifier: string, enabled = true) =>
  useQuery({
    queryKey: ['retailers', 'detail', identifier],
    queryFn: () => retailerApi.get(identifier),
    enabled: Boolean(identifier && enabled),
  });
export const useRegistration = (code: string, enabled = true) => useQuery({ queryKey: ['retailers', 'registration', code], queryFn: () => retailerApi.registration(code), enabled });
export const useRetailerMlor = (code: string, enabled = true) => useQuery({ queryKey: ['retailers', 'mlor', code], queryFn: () => retailerApi.mlor(code), enabled });
export const useRetailerMlorConfigs = (retailerId: string, enabled = true) =>
  useQuery({
    queryKey: ['retailers', 'mlor-configs', retailerId],
    queryFn: () => retailerApi.mlorConfigs(retailerId),
    enabled: Boolean(retailerId && enabled),
  });
export const useResolveMlor = (retailerId: string, productId: string, enabled = true) =>
  useQuery({
    queryKey: ['retailers', 'mlor-resolution', retailerId, productId],
    queryFn: () => retailerApi.resolveMlor(retailerId, productId),
    enabled: Boolean(retailerId && productId && enabled),
  });
export const useSetMlor = (retailerId?: string) => {
  const queryClient = useQueryClient();
  return useApiMutation(
    (payload: SetMlorPayload) => retailerApi.setMlor(payload),
    {
      permission: 'mlor.manage',
      success: 'Đã lưu cấu hình MLOR.',
      onSuccess: () => {
        if (retailerId) {
          void queryClient.invalidateQueries({ queryKey: ['retailers', 'mlor-configs', retailerId] });
          void queryClient.invalidateQueries({ queryKey: ['retailers', 'mlor-resolution', retailerId] });
          void queryClient.invalidateQueries({ queryKey: ['retailers', 'detail'] });
        }
      },
    },
  );
};
export const useDeleteMlor = (retailerId?: string) => {
  const queryClient = useQueryClient();
  return useApiMutation(
    (mlorId: string) => retailerApi.deleteMlor(mlorId),
    {
      permission: 'mlor.manage',
      success: 'Đã xóa cấu hình MLOR.',
      onSuccess: () => {
        if (retailerId) {
          void queryClient.invalidateQueries({ queryKey: ['retailers', 'mlor-configs', retailerId] });
          void queryClient.invalidateQueries({ queryKey: ['retailers', 'mlor-resolution', retailerId] });
          void queryClient.invalidateQueries({ queryKey: ['retailers', 'detail'] });
        }
      },
    },
  );
};
export const useUpdateRetailerProfile = () => {
  const queryClient = useQueryClient();
  return useApiMutation(
    ({ retailerId, payload }: { retailerId: string; payload: UpdateRetailerProfilePayload }) =>
      retailerApi.updateProfile(retailerId, payload),
    {
      permission: 'retailers.edit',
      success: 'Đã cập nhật hồ sơ điểm bán.',
      onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['retailers'] }); },
    },
  );
};
export const useUpdateRetailerDeclaration = () => {
  const queryClient = useQueryClient();
  return useApiMutation(
    ({ retailerId, payload }: { retailerId: string; payload: UpdateRetailerDeclarationPayload }) =>
      retailerApi.updateDeclaration(retailerId, payload),
    {
      permission: 'retailers.edit',
      success: 'Cập nhật thông tin Retailer thành công.',
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['retailers'] });
      },
    },
  );
};
export const useRetailerReceivables = (retailerId?: string, retailerCode?: string, enabled = true) =>
  useQuery({
    queryKey: ['retailers', 'receivables', retailerId || '', retailerCode || ''],
    queryFn: () => retailerApi.receivables(retailerId, retailerCode),
    enabled: Boolean((retailerId || retailerCode) && enabled),
  });
export const useRetailerLoyalty = (retailerIdOrCode: string, enabled = true) =>
  useQuery({
    queryKey: ['retailers', 'loyalty', retailerIdOrCode],
    queryFn: () => retailerApi.loyalty(retailerIdOrCode),
    enabled: Boolean(retailerIdOrCode && enabled),
  });
export const useRetailerLookups = (enabled = true) => ({
  areas: useQuery({ queryKey: ['retailers', 'areas'], queryFn: retailerApi.areas, enabled }),
  groups: useQuery({ queryKey: ['retailers', 'groups'], queryFn: retailerApi.groups, enabled }),
});
export const useCreateRetailer = () => useApiMutation(retailerApi.create, { permission: 'retailers.create', success: (r) => `Đã tạo retailer ${r.code} · ${r.name}.` });
export const useUpdateRetailer = () => useApiMutation(retailerApi.update, { permission: 'retailers.edit', success: (r) => `Đã cập nhật retailer ${r.code}.` });
export const useApproveRegistration = () => useApiMutation(retailerApi.approve, { permission: 'retailers.review', success: (r) => `Đã duyệt ${r.registration.code}: cấp mã điểm bán ${r.retailer.code} và báo Sales.` });
export const useRejectRegistration = () => useApiMutation(retailerApi.reject, { permission: 'retailers.review', success: (r) => `Đã từ chối ${r.code}.` });
export const useSaveMlor = () => useApiMutation(retailerApi.saveMlor, { permission: 'mlor.manage', success: 'Đã lưu MLOR của retailer.' });
export const useRetailerEligibility = (retailerId: string, enabled = true) =>
  useQuery({
    queryKey: ['retailers', 'eligibility', retailerId],
    queryFn: () => retailerApi.eligibility(retailerId),
    enabled: Boolean(retailerId && enabled),
  });
export const useUpdateCreditTerms = () =>
  useApiMutation(retailerApi.updateCreditTerms, {
    permission: 'retailers.review',
    success: (r) => `Đã cập nhật kỳ hạn công nợ cho điểm bán ${r.code}.`,
  });
