import { get, getAll, post } from '@/shared/api/http';
import type { AppNotification, MenuBadges } from './types';

export const notificationApi = {
  list: () => getAll<AppNotification>('/notifications'),
  markRead: (id: string) => post(`/notifications/${id}/read`),
  badges: () => get<MenuBadges>('/notifications/badges'),
};
