import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/errors';
import { regionApi } from './api';
import { loadManagerTerritory, requireManagedGroup, type ManagerTerritory } from './managerTerritory';
import type { TransferInput } from './types';

function useTerritoryReader<T>(
  key: readonly unknown[],
  adminRead: () => Promise<T>,
  managerRead: (territory: ManagerTerritory) => T | Promise<T>,
  enabled = true,
) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useQuery({
    queryKey: ['regions', ...key, user?.id, user?.role, user?.scope],
    enabled: enabled && (user?.role === 'Admin' || user?.role === 'SalesManager'),
    queryFn: async () => {
      if (!user) throw new ApiError(401, 'Bạn cần đăng nhập.');
      if (user.role === 'Admin') return adminRead();
      if (user.role !== 'SalesManager') throw new ApiError(403, 'Không có quyền xem địa bàn.');
      const territory = await client.fetchQuery({
        queryKey: ['regions', 'manager-territory', user.id, user.scope],
        queryFn: () => loadManagerTerritory(user),
        staleTime: 10_000,
      });
      return managerRead(territory);
    },
  });
}

export const useAreas = () =>
  useTerritoryReader(['areas'], regionApi.areas, (t) => t.areas);

export const useGroups = () =>
  useTerritoryReader(['groups'], regionApi.groups, (t) => t.groups);

export const useGroup = (code: string) =>
  useTerritoryReader(['group', code], () => regionApi.group(code),
    (t) => requireManagedGroup(t, code), Boolean(code));

export const useStaff = (enabled = true) =>
  useTerritoryReader(['staff'], regionApi.staff, (t) => t.staff, enabled);

export function useManagers(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['regions', 'managers', user?.id],
    queryFn: regionApi.managers,
    enabled: enabled && user?.role === 'Admin',
  });
}

export const useGroupRetailers = (code: string) =>
  useTerritoryReader(['group-retailers', code],
    () => regionApi.retailersInGroup(code),
    (t) => regionApi.retailersInGroup(requireManagedGroup(t, code).id!),
    Boolean(code));

export const useCreateArea = () =>
  useApiMutation(regionApi.createArea, { permission: 'regions.manage' });

export const useCreateGroup = () =>
  useApiMutation(regionApi.createGroup, { permission: 'salesGroups.manage' });

export const useUpdateGroup = () =>
  useApiMutation(regionApi.updateGroup, { permission: 'salesGroups.manage' });

export function useTransferStaff() {
  const { user } = useAuth();
  return useApiMutation(async (input: TransferInput) => {
    if (user?.role === 'SalesManager') {
      const territory = await loadManagerTerritory(user);
      const staff = territory.staff.find((s) => input.userId
        ? s.userId === input.userId : s.name === input.name);
      if (!staff) throw new ApiError(403, 'Nhân viên nằm ngoài phạm vi được phân công.');
      const group = requireManagedGroup(territory, input.destinationSalesGroupId || input.toGroup);
      return regionApi.transfer({ ...input, userId: staff.userId, destinationSalesGroupId: group.id });
    }
    return regionApi.transfer(input);
  }, { permission: 'territory.assign' });
}
