import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { configApi, transitApi } from './api';

export const useSettings = () => useQuery({ queryKey: ['config', 'settings'], queryFn: configApi.settings });
export const useSaveConfig = () => useApiMutation(configApi.save, { success: 'Đã lưu cấu hình hệ thống. Đơn mới và job luân chuyển kế tiếp dùng giá trị này.' });

export const useTransitTable = () => useQuery({ queryKey: ['transit', 'current'], queryFn: transitApi.current });
export const useTransitHistory = () => useQuery({ queryKey: ['transit', 'history'], queryFn: transitApi.history });
export const usePublishTransitTable = () => useApiMutation(transitApi.publish, {
  success: 'Đã phát hành phiên bản bảng vận chuyển mới. Phiên bản cũ được giữ lại để giải thích các đợt đã chạy.',
});
