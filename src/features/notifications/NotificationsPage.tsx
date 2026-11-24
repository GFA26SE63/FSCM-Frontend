import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, Card, PageHeader, Pagination } from '@/shared/ui';
import { formatShortDateTime } from '@/shared/lib/dates';
import { errorMessage } from '@/shared/api/errors';
import { useMarkAllRead, useMarkRead, useNotificationPage, useNotifications } from './hooks';
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
  const [size, setSize] = useState(10);
  const [paging, setPaging] = useState<{ page: number; after?: string; before?: string }>({ page: 1 });
  const summary = useNotifications(1);
  const notifications = useNotificationPage(size, tab === 'unread', paging.after, paging.before);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const navigate = useNavigate();

  const rows = notifications.data?.rows ?? [];
  const unreadCount = summary.data?.unread.totalCount;
  const totalCount = summary.data?.all.totalCount;
  const changeTab = (next: Tab) => { setTab(next); setPaging({ page: 1 }); };

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
        actions={unreadCount != null && unreadCount > 0 ? (
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
        {summary.isError && <p role="alert">Không tải được tổng số thông báo. <Button size="sm" onClick={() => void summary.refetch()}>Thử lại</Button></p>}
        <div className="notification-tabs" role="tablist" aria-label="Bộ lọc thông báo">
          <button type="button" role="tab" aria-selected={tab === 'all'} className={`pill${tab === 'all' ? ' active' : ''}`} onClick={() => changeTab('all')}>
            Tất cả ({totalCount ?? '…'})
          </button>
          <button type="button" role="tab" aria-selected={tab === 'unread'} className={`pill${tab === 'unread' ? ' active' : ''}`} onClick={() => changeTab('unread')}>
            Chưa đọc ({unreadCount ?? '…'})
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

        {notifications.data && <Pagination currentPage={paging.page} totalCount={notifications.data.totalCount}
          pageSize={size} itemCount={rows.length} totalPages={Math.max(1, Math.ceil(notifications.data.totalCount / size))}
          loading={notifications.isFetching} hasPrev={notifications.data.pageInfo.hasPreviousPage} hasNext={notifications.data.pageInfo.hasNextPage}
          navigablePages={[1, paging.page, ...(notifications.data.pageInfo.hasPreviousPage ? [paging.page - 1] : []), ...(notifications.data.pageInfo.hasNextPage ? [paging.page + 1] : [])]}
          onPrev={() => setPaging(paging.page <= 2 ? { page: 1 } : { page: paging.page - 1, before: notifications.data?.pageInfo.startCursor ?? undefined })}
          onNext={() => setPaging({ page: paging.page + 1, after: notifications.data?.pageInfo.endCursor ?? undefined })}
          onPage={n => {
            if (n === 1) setPaging({ page: 1 });
            else if (n === paging.page - 1) setPaging({ page: n, before: notifications.data?.pageInfo.startCursor ?? undefined });
            else if (n === paging.page + 1) setPaging({ page: n, after: notifications.data?.pageInfo.endCursor ?? undefined });
          }}
          onPageSizeChange={n => { setSize(n); setPaging({ page: 1 }); }} />}
      </Card>
    </>
  );
}
