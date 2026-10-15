import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button } from '@/shared/ui';
import { formatShortDateTime } from '@/shared/lib/dates';
import { useMarkRead, useNotifications } from '../hooks';

/** Bell in the top bar: unread counter + dropdown with the latest in-app notifications. */
export function NotificationBell() {
  const { data = [] } = useNotifications();
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = data.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="bell" ref={ref}>
      <Button onClick={() => setOpen((o) => !o)} aria-label="Thông báo" style={{ position: 'relative' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && <span className="bell-badge">{unread}</span>}
      </Button>
      {open && (
        <div className="bell-menu card" role="menu">
          <div className="bell-hd sec">Thông báo</div>
          {data.length === 0 && <p className="muted" style={{ padding: 16, margin: 0 }}>Không có thông báo.</p>}
          {data.map((n) => (
            <button
              key={n.id}
              className={`bell-item${n.read ? '' : ' unread'}`}
              onClick={() => {
                if (!n.read) markRead.mutate(n.id);
                setOpen(false);
                if (n.link) navigate(n.link);
              }}
            >
              <span className="bold">{n.title}</span>
              <span className="small muted">{n.body}</span>
              <span className="small muted">{formatShortDateTime(n.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
