import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { regionApi } from './api';

export const useAreas = () =>
  useQuery({
    queryKey: ['regions', 'areas'],
    queryFn: regionApi.areas,
  });

export const useGroups = () =>
  useQuery({
    queryKey: ['regions', 'groups'],
    queryFn: regionApi.groups,
  });

export const useGroup = (code: string) =>
  useQuery({
    queryKey: ['regions', 'group', code],
    queryFn: () => regionApi.group(code),
  });

export const useStaff = () =>
  useQuery({
    queryKey: ['regions', 'staff'],
    queryFn: regionApi.staff,
  });

export const useCreateArea = () =>
  useApiMutation(regionApi.createArea, {
    permission: 'regions.manage',
    success: (area) => `Đã tạo khu vực ${area.name}.`,
  });

export const useCreateGroup = () =>
  useApiMutation(regionApi.createGroup, {
    permission: 'salesGroups.manage',
    success: (group) => `Đã tạo nhóm Sales ${group.code}.`,
  });

export const useUpdateGroup = () =>
  useApiMutation(regionApi.updateGroup, {
    permission: 'salesGroups.manage',
    success: (group) => `Đã cập nhật nhóm ${group.code}.`,
  });

export const useTransferStaff = () =>
  useApiMutation(regionApi.transfer, {
    permission: 'territory.assign',
    success: (result) =>
      `Đã chuyển ${result.name} sang nhóm ${result.toGroup}.`,
  });