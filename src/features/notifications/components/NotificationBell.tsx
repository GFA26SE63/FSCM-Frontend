import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, Modal } from '@/shared/ui';
import { formatShortDateTime } from '@/shared/lib/dates';
import { useMarkAllRead, useMarkRead, useNotifications } from '../hooks';
import { NOTIFICATIONS_MAX_LIMIT, NOTIFICATIONS_PAGE_SIZE } from '../notificationsGraphql';
import type { AppNotification } from '../types';

const portalLink = (deepLink: string | null) => {
  if (!deepLink) return null;
  const batchPrefix = '/inventory/batches/';
  return deepLink.startsWith(batchPrefix)
    ? `/batches/${deepLink.slice(batchPrefix.length)}`
    : deepLink;
};

/** Bell in the top bar: unread counter + dropdown with latest in-app notifications using common UI components. */
export function NotificationBell() {
  const [limit, setLimit] = useState(NOTIFICATIONS_PAGE_SIZE);
  const { data } = useNotifications(limit);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = data?.unread.totalCount ?? 0;
  const totalCount = data?.all.totalCount ?? 0;
  const window = tab === 'unread' ? data?.unread : data?.all;
  const filtered = window?.rows ?? [];
  const canLoadMore = !!window && window.rows.length < window.totalCount && limit < NOTIFICATIONS_MAX_LIMIT;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const handleMarkAll = () => markAllRead.mutate(undefined);

  const showDetail = (notification: AppNotification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    setOpen(false);
    setSelected(notification);
  };

  const openRelatedPage = () => {
    const target = selected && portalLink(selected.deepLink);
    if (!target) return;
    setSelected(null);
    navigate(target);
  };

  return (
    <div className="bell" ref={ref}>
      <Button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Thông báo"
        style={{ position: 'relative' }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
          <path d="M10 21h4" />
        </svg>
        <span>Thông báo</span>
        {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
      </Button>

      {open && (
        <div className="bell-menu card" role="dialog" aria-label="Thông báo">
          <div className="bell-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="sec">Thông báo</span>
            {unreadCount > 0 && (
              <button type="button" className="link-btn small" onClick={handleMarkAll} disabled={markAllRead.isPending}>
                {markAllRead.isPending ? 'Đang đánh dấu…' : 'Đánh dấu tất cả đã đọc'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--c-border-soft)' }}>
            <button
              type="button"
              className={`pill${tab === 'all' ? ' active' : ''}`}
              onClick={() => setTab('all')}
            >
              Tất cả ({totalCount})
            </button>
            <button
              type="button"
              className={`pill${tab === 'unread' ? ' active' : ''}`}
              onClick={() => setTab('unread')}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          <div className="bell-list">
            {filtered.length === 0 ? (
              <p className="muted small" style={{ textAlign: 'center', padding: 24, margin: 0 }}>
                {tab === 'unread' ? 'Không có thông báo chưa đọc.' : 'Không có thông báo nào.'}
              </p>
            ) : (
              filtered.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`bell-item${n.isRead ? '' : ' unread'}`}
                  disabled={markRead.isPending}
                  onClick={() => showDetail(n)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span className="bold">{n.title}</span>
                    {!n.isRead && <span className="menu-dot" style={{ background: 'var(--c-primary)' }} />}
                  </div>
                  <span className="small muted">{n.message}</span>
                  <span className="small muted">{formatShortDateTime(n.createdAt)}</span>
                </button>
              ))
            )}
            {canLoadMore && (
              <button
                type="button"
                className="link-btn small"
                style={{ display: 'block', margin: '8px auto' }}
                onClick={() => setLimit((l) => Math.min(l + NOTIFICATIONS_PAGE_SIZE, NOTIFICATIONS_MAX_LIMIT))}
              >
                Xem thêm
              </button>
            )}
          </div>
          <div className="bell-footer">
            <button type="button" className="link-btn small" onClick={() => { setOpen(false); navigate('/notifications'); }}>
              Xem tất cả thông báo
            </button>
          </div>
        </div>
      )}
      <Modal
        open={selected !== null}
        title={selected?.title ?? 'Thông báo'}
        subtitle={selected ? formatShortDateTime(selected.createdAt) : undefined}
        onClose={() => setSelected(null)}
        footer={selected && portalLink(selected.deepLink) ? (
          <Button variant="primary" onClick={openRelatedPage}>Mở nghiệp vụ liên quan</Button>
        ) : undefined}
      >
        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{selected?.message}</p>
      </Modal>
    </div>
  );
}
