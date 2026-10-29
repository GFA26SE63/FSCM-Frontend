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
    enabled: !!code,
  });

export const useStaff = () =>
  useQuery({
    queryKey: ['regions', 'staff'],
    queryFn: regionApi.staff,
  });

export const useManagers = () =>
  useQuery({
    queryKey: ['regions', 'managers'],
    queryFn: regionApi.managers,
  });

export const useGroupRetailers = (groupCode: string) =>
  useQuery({
    queryKey: ['regions', 'group-retailers', groupCode],
    queryFn: () => regionApi.retailersInGroup(groupCode),
    enabled: !!groupCode,
  });

export const useCreateArea = () =>
  useApiMutation(regionApi.createArea, {
    permission: 'regions.manage',
  });

export const useCreateGroup = () =>
  useApiMutation(regionApi.createGroup, {
    permission: 'salesGroups.manage',
  });

export const useUpdateGroup = () =>
  useApiMutation(regionApi.updateGroup, {
    permission: 'salesGroups.manage',
  });

export const useTransferStaff = () =>
  useApiMutation(regionApi.transfer, {
    permission: 'territory.assign',
  });
