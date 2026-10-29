import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { regionApi } from './api';
import type { AreaInput, GroupInput, TransferInput } from './types';

export const useAreas = () =>
  useQuery({ queryKey: ['regions', 'areas'], queryFn: regionApi.areas });

export const useGroups = () =>
  useQuery({ queryKey: ['regions', 'groups'], queryFn: regionApi.groups });

export const useGroup = (code: string) =>
  useQuery({
    queryKey: ['regions', 'group', code],
    queryFn: () => regionApi.group(code),
    enabled: !!code,
  });

export const useStaff = () =>
  useQuery({ queryKey: ['regions', 'staff'], queryFn: regionApi.staff });

export const useManagers = () =>
  useQuery({ queryKey: ['regions', 'managers'], queryFn: regionApi.managers });

export const useGroupRetailers = (groupCode: string) =>
  useQuery({
    queryKey: ['regions', 'group-retailers', groupCode],
    queryFn: () => regionApi.retailersInGroup(groupCode),
    enabled: !!groupCode,
  });

export function useCreateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: AreaInput) => regionApi.createArea(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regions'] });
    },
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: GroupInput) => regionApi.createGroup(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regions'] });
    },
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: GroupInput) => regionApi.updateGroup(v),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['regions'] });
      qc.invalidateQueries({ queryKey: ['regions', 'group', v.code] });
    },
  });
}

export function useTransferStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: TransferInput) => regionApi.transfer(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regions'] });
    },
  });
}
