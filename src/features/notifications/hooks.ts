import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { notificationApi } from './api';
import { fetchNotifications } from './notificationsGraphql';

export const notificationKeys = { all: ['notifications'] as const, badges: ['notifications', 'badges'] as const };

/** Newest-first window of the signed-in user's notifications (server-scoped) + tab counts. */
export const useNotifications = (limit: number) =>
  useQuery({
    queryKey: [...notificationKeys.all, 'window', limit],
    queryFn: () => fetchNotifications(limit),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });
export const useMenuBadges = () => useQuery({ queryKey: notificationKeys.badges, queryFn: notificationApi.badges, retry: false, refetchInterval: 60_000 });
export const useMarkRead = () => useApiMutation(notificationApi.markRead, { notify: false });
export const useMarkAllRead = () => useApiMutation(notificationApi.markAllRead, {
  success: (result) => result.updatedCount > 0
    ? `Đã đánh dấu ${result.updatedCount} thông báo là đã đọc.`
    : 'Không có thông báo chưa đọc.',
});
