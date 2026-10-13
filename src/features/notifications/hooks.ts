import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { notificationApi } from './api';

export const notificationKeys = { all: ['notifications'] as const, badges: ['notifications', 'badges'] as const };

export const useNotifications = () => useQuery({ queryKey: notificationKeys.all, queryFn: notificationApi.list, refetchInterval: 60_000 });
export const useMenuBadges = () => useQuery({ queryKey: notificationKeys.badges, queryFn: notificationApi.badges, retry: false, refetchInterval: 60_000 });
export const useMarkRead = () => useApiMutation(notificationApi.markRead);
