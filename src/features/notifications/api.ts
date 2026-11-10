import { get, getAll, patch } from '@/shared/api/http';
import type { AppNotification, MarkAllNotificationsReadResult, NotificationBadge } from './types';

export const notificationApi = {
  list: () => getAll<AppNotification>('/notifications'),
  markRead: (id: string) => patch<AppNotification>(`/notifications/${id}/read`),
  markAllRead: () => patch<MarkAllNotificationsReadResult>('/notifications/read-all'),
  badges: () => get<NotificationBadge>('/notifications/badges'),
};
