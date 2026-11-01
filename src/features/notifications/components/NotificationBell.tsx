import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button } from '@/shared/ui';
import { formatShortDateTime } from '@/shared/lib/dates';
import { useMarkRead, useNotifications } from '../hooks';

/** Bell in the top bar: unread counter + dropdown with latest in-app notifications using common UI components. */
export function NotificationBell() {
  const { data = [] } = useNotifications();
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = data.filter((n) => !n.read).length;
  const filtered = tab === 'unread' ? data.filter((n) => !n.read) : data;

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

  const handleMarkAll = () => {
    data.filter((n) => !n.read).forEach((n) => markRead.mutate(n.id));
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
              <button type="button" className="link-btn small" onClick={handleMarkAll}>
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--c-border-soft)' }}>
            <button
              type="button"
              className={`pill${tab === 'all' ? ' active' : ''}`}
              onClick={() => setTab('all')}
            >
              Tất cả ({data.length})
            </button>
            <button
              type="button"
              className={`pill${tab === 'unread' ? ' active' : ''}`}
              onClick={() => setTab('unread')}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 360 }}>
            {filtered.length === 0 ? (
              <p className="muted small" style={{ textAlign: 'center', padding: 24, margin: 0 }}>
                {tab === 'unread' ? 'Không có thông báo chưa đọc.' : 'Không có thông báo nào.'}
              </p>
            ) : (
              filtered.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`bell-item${n.read ? '' : ' unread'}`}
                  onClick={() => {
                    if (!n.read) markRead.mutate(n.id);
                    setOpen(false);
                    if (n.link) navigate(n.link);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span className="bold">{n.title}</span>
                    {!n.read && <span className="menu-dot" style={{ background: 'var(--c-primary)' }} />}
                  </div>
                  <span className="small muted">{n.body}</span>
                  <span className="small muted">{formatShortDateTime(n.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
