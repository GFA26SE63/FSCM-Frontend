import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Card, PageHeader } from '@/shared/ui';
import { formatShortDateTime } from '@/shared/lib/dates';
import { errorMessage } from '@/shared/api/errors';
import { useMarkAllRead, useMarkRead, useNotifications } from './hooks';
import { NOTIFICATIONS_MAX_LIMIT, NOTIFICATIONS_PAGE_SIZE } from './notificationsGraphql';
import type { AppNotification } from './types';

type Tab = 'all' | 'unread';

const portalLink = (deepLink: string | null) => {
  if (!deepLink) return null;
  const batchPrefix = '/inventory/batches/';
  return deepLink.startsWith(batchPrefix)
    ? `/batches/${deepLink.slice(batchPrefix.length)}`
    : deepLink;
};

/**
 * Personal notification history for every Portal role.
 * The API is recipient-scoped server-side; this page never accepts a recipient id.
 */
export function NotificationsPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [limit, setLimit] = useState(NOTIFICATIONS_PAGE_SIZE);
  const notifications = useNotifications(limit);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const navigate = useNavigate();

  const window = tab === 'unread' ? notifications.data?.unread : notifications.data?.all;
  const rows = window?.rows ?? [];
  const unreadCount = notifications.data?.unread.totalCount ?? 0;
  const totalCount = notifications.data?.all.totalCount ?? 0;
  const canLoadMore = !!window && window.rows.length < window.totalCount && limit < NOTIFICATIONS_MAX_LIMIT;

  const openNotification = (notification: AppNotification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const target = portalLink(notification.deepLink);
    if (target) navigate(target);
  };

  return (
    <>
      <PageHeader
        title="Thông báo"
        subtitle="Các thông báo dành riêng cho tài khoản của bạn. Thông báo của người dùng khác không được hiển thị."
        actions={unreadCount > 0 ? (
          <button
            type="button"
            className="btn"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate(undefined)}
          >
            Đánh dấu tất cả đã đọc
          </button>
        ) : undefined}
      />

      <Card>
        <div className="notification-tabs" role="tablist" aria-label="Bộ lọc thông báo">
          <button type="button" role="tab" aria-selected={tab === 'all'} className={`pill${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>
            Tất cả ({totalCount})
          </button>
          <button type="button" role="tab" aria-selected={tab === 'unread'} className={`pill${tab === 'unread' ? ' active' : ''}`} onClick={() => setTab('unread')}>
            Chưa đọc ({unreadCount})
          </button>
        </div>

        {notifications.isLoading ? (
          <p className="muted">Đang tải thông báo…</p>
        ) : notifications.isError ? (
          <div className="callout callout-danger" role="alert">
            {errorMessage(notifications.error)}
            <button type="button" className="link-btn" onClick={() => void notifications.refetch()}>Thử lại</button>
          </div>
        ) : rows.length === 0 ? (
          <p className="muted notification-empty">{tab === 'unread' ? 'Bạn không có thông báo chưa đọc.' : 'Bạn chưa có thông báo nào.'}</p>
        ) : (
          <div className="notification-list" role="list">
            {rows.map((notification) => (
              <button
                key={notification.id}
                type="button"
                role="listitem"
                className={`notification-row${notification.isRead ? '' : ' unread'}`}
                disabled={markRead.isPending}
                onClick={() => openNotification(notification)}
              >
                <span className="notification-row-title">
                  {notification.title}
                  {!notification.isRead && <span className="menu-dot" aria-label="Chưa đọc" />}
                </span>
                <span>{notification.message}</span>
                <span className="small muted">{formatShortDateTime(notification.createdAt)}</span>
              </button>
            ))}
          </div>
        )}

        {canLoadMore && (
          <div className="notification-load-more">
            <button type="button" className="btn" onClick={() => setLimit((current) => Math.min(current + NOTIFICATIONS_PAGE_SIZE, NOTIFICATIONS_MAX_LIMIT))}>
              Xem thêm
            </button>
          </div>
        )}
      </Card>
    </>
  );
}
