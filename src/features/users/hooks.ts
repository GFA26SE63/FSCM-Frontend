import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { userApi } from './api';
import type { UserFilters } from './types';

export const useUsers = (filters: UserFilters) =>
  useQuery({
    queryKey: ['users', 'list', filters],
    queryFn: () => userApi.list(filters),
  });

export const useUser = (id: string) =>
  useQuery({
    queryKey: ['users', 'detail', id],
    queryFn: () => userApi.get(id),
    enabled: !!id,
  });

export const useSetUserStatus = () =>
  useApiMutation(userApi.setStatus, {
    success: (_, input) =>
      input.isActive
        ? 'Đã bật tài khoản.'
        : 'Đã khóa tài khoản.',
  });