import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { configApi } from './api';

export const useSettings = () => useQuery({ queryKey: ['config', 'settings'], queryFn: configApi.settings });
export const useTransitTable = () => useQuery({ queryKey: ['config', 'transit'], queryFn: configApi.transit });
export const useSaveConfig = () => useApiMutation(configApi.save, { success: 'Đã lưu cấu hình hệ thống. Đơn mới và job luân chuyển kế tiếp dùng giá trị này.' });
