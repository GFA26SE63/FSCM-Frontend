import { useEffect, type ReactNode } from 'react';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** Grey body like the prototype's trace window. */
  wide?: boolean;
  height?: number | string;
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}

export function Modal({ open, title, subtitle, onClose, children, footer, width = 520, wide, height }: ModalProps) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" style={{ width, height }}>
        <div className="modal-hd">
          <div className="spacer">
            <div className="modal-title">{title}</div>
            {subtitle && <div className="muted small">{subtitle}</div>}
          </div>
          <Button onClick={onClose} aria-label="Đóng">
            Đóng
          </Button>
        </div>
        <div className="modal-bd" style={{ flex: 1 }}>
          {children}
        </div>
        {footer && <div className="modal-ft">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, title, subtitle, onClose, children, footer, width = 980 }: Omit<ModalProps, 'wide' | 'height'>) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="overlay drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" style={{ width }}>
        <div className="modal-hd">
          <div className="spacer" style={{ minWidth: 0 }}>
            <div className="modal-title">{title}</div>
            {subtitle && <div className="muted small">{subtitle}</div>}
          </div>
          <Button onClick={onClose}>Đóng</Button>
        </div>
        <div className="modal-bd" style={{ flex: 1 }}>
          {children}
        </div>
        {footer && <div className="modal-ft">{footer}</div>}
      </aside>
    </div>
  );
}
