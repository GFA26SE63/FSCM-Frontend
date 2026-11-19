/**
 * Notifications via GraphQL `entities.notifications` (HotChocolate cursor pagination).
 *
 * User scope (verified in FSCM-Backend EntityQueryService.cs): the resolver is ALWAYS restricted
 * server-side to `UserAccountId == authenticated user`, for every role. The client sends no
 * recipient filter and never sees another user's rows.
 * Verified Notification fields: id, userAccountId, type, title, message, isRead, createdAt, readAt,
 * relatedEntityType, relatedEntityId, deepLink (+ outbox/order ids not needed here).
 *
 * The bell shows a bounded, newest-first window (`limit`, grown by the user) instead of the old
 * "download every notification" REST call. `totalCount` gives the real counts for the
 * "Tất cả" / "Chưa đọc" tabs in the same single request (two aliased connections). Mark-read /
 * mark-all-read stay REST; the shared mutation hook invalidates all queries, so this refreshes.
 *
 * HC0047: first/last must be literals in the query string, not variables.
 */
import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import type { AppNotification } from './types';

export const NOTIFICATIONS_PAGE_SIZE = 20;
export const NOTIFICATIONS_MAX_LIMIT = 200;

export interface NotificationWindow {
  rows: AppNotification[];
  totalCount: number;
}

export interface NotificationsSummary {
  all: NotificationWindow;
  unread: NotificationWindow;
}

export function buildNotificationsQuery(limit: number): string {
  if (!Number.isInteger(limit) || limit < 1 || limit > NOTIFICATIONS_MAX_LIMIT) throw new Error('invalid limit');
  const fields = 'id type title message createdAt isRead readAt relatedEntityType relatedEntityId deepLink';
  const order = 'order: [{ createdAt: DESC }, { id: DESC }]';
  return `query NotificationsBell {
  entities {
    all: notifications(first: ${limit}, ${order}) {
      totalCount
      nodes { ${fields} }
    }
    unread: notifications(first: ${limit}, where: { isRead: { eq: false } }, ${order}) {
      totalCount
      nodes { ${fields} }
    }
  }
}`;
}

type Conn = { totalCount?: number; nodes?: AppNotification[] | null };

const toWindow = (c: Conn | undefined): NotificationWindow => {
  if (!c || typeof c.totalCount !== 'number' || !Array.isArray(c.nodes)) {
    throw new ApiError(502, 'Không tải được thông báo', 'Phản hồi thông báo không hợp lệ.');
  }
  return { rows: c.nodes, totalCount: c.totalCount };
};

export async function fetchNotifications(limit: number): Promise<NotificationsSummary> {
  const data = await graphql<{ entities: { all?: Conn; unread?: Conn } }>(buildNotificationsQuery(limit), {});
  return { all: toWindow(data.entities?.all), unread: toWindow(data.entities?.unread) };
}
