import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { regionApi } from './api';

export const useAreas = () => useQuery({ queryKey: ['regions', 'areas'], queryFn: regionApi.areas });
export const useGroups = () => useQuery({ queryKey: ['regions', 'groups'], queryFn: regionApi.groups });
export const useGroup = (code: string) => useQuery({ queryKey: ['regions', 'group', code], queryFn: () => regionApi.group(code) });
export const useStaff = () => useQuery({ queryKey: ['regions', 'staff'], queryFn: regionApi.staff });
export const useCreateArea = () => useApiMutation(regionApi.createArea, { success: (a) => `Đã tạo khu vực ${a.name}.` });
export const useCreateGroup = () => useApiMutation(regionApi.createGroup, { success: (g) => `Đã tạo nhóm Sales ${g.code}.` });
export const useUpdateGroup = () => useApiMutation(regionApi.updateGroup, { success: (g) => `Đã cập nhật nhóm ${g.code}.` });
export const useTransferStaff = () => useApiMutation(regionApi.transfer, { success: (r) => `Đã chuyển ${r.name} sang nhóm ${r.toGroup}.` });
