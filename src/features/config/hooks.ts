import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { backgroundJobsApi, configApi, runScheduleApi, transitApi } from './api';

export const useSettings = () => useQuery({ queryKey: ['config', 'settings'], queryFn: configApi.settings });
export const useSaveConfig = () => useApiMutation(configApi.save, { success: 'Đã lưu cấu hình. Đơn mới dùng điều kiện vừa công bố.' });

export const useTransitTable = () => useQuery({ queryKey: ['transit', 'current'], queryFn: transitApi.current });
export const useTransitHistory = () => useQuery({ queryKey: ['transit', 'history'], queryFn: transitApi.history });
export const usePublishTransitTable = () => useApiMutation(transitApi.publish, {
  success: 'Đã phát hành phiên bản bảng vận chuyển mới. Phiên bản cũ được giữ lại để giải thích các đợt đã chạy.',
});

export const useRunSchedule = () => useQuery({ queryKey: ['run-schedule'], queryFn: runScheduleApi.current });
export const usePublishRunSchedule = () => useApiMutation(runScheduleApi.publish, {
  success: 'Đã lưu cấu hình thời gian nhận dự kiến cho luồng phân bổ theo thời gian thực.',
});


export const useBackgroundJobs = () => useQuery({ queryKey: ['config', 'background-jobs'], queryFn: backgroundJobsApi.current });
export const useSaveBackgroundJobs = () => useApiMutation(backgroundJobsApi.save, {
  success: 'Đã lưu cấu hình tác vụ nền. Backend nhận thay đổi trong vòng 15 giây.',
});

export const useSaveConfigurationEntries = () => useApiMutation(configApi.saveEntries, {
  success: 'Đã lưu toàn bộ cấu hình của nhóm.',
});
