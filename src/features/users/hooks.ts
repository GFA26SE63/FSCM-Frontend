import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { userApi } from './api';

export const useUsers = () => useQuery({ queryKey: ['users', 'list'], queryFn: userApi.list });
export const useUser = (id: string) => useQuery({ queryKey: ['users', 'detail', id], queryFn: () => userApi.get(id) });
export const useUserLookups = (enabled: boolean) => ({
  warehouses: useQuery({ queryKey: ['users', 'warehouses'], queryFn: userApi.warehouses, enabled }),
  groups: useQuery({ queryKey: ['users', 'groups'], queryFn: userApi.groups, enabled }),
  retailers: useQuery({ queryKey: ['users', 'retailers'], queryFn: userApi.retailers, enabled }),
});
export const useCreateUser = () => useApiMutation(userApi.create, { success: (u) => `Đã tạo tài khoản ${u.loginName} (${u.role}).` });
export const useSetUserStatus = () => useApiMutation(userApi.setStatus, { success: (u) => (u.status === 'Locked' ? `Đã khóa tài khoản ${u.loginName}.` : `Đã mở khóa tài khoản ${u.loginName}.`) });
