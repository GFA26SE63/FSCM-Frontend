export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  readAt: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  deepLink: string | null;
}

export interface NotificationBadge {
  unreadCount: number;
  hasUnread: boolean;
}

export interface MarkAllNotificationsReadResult {
  updatedCount: number;
  readAt: string;
}
