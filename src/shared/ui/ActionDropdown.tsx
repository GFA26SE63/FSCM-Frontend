import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export interface ActionDropdownItem {
  key: string;
  label: string;
  icon?: ReactNode;
  color?: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

interface ActionDropdownProps {
  items: ActionDropdownItem[];
  triggerTitle?: string;
}

/**
 * Three-dot action dropdown menu rendered in a portal with fixed positioning,
 * ensuring it is never clipped by table overflow/scroll containers.
 */
export function ActionDropdown({ items, triggerTitle = 'Thao tác khác' }: ActionDropdownProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    const menuHeight = items.length * 36 + 12;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight && rect.top > menuHeight;
    const top = openUp ? rect.top - menuHeight - 4 : rect.bottom + 4;
    setCoords({ top, right });
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
    } else {
      updatePosition();
      setOpen(true);
    }
  };

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleScroll = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-sm"
        title={triggerTitle}
        aria-label={triggerTitle}
        onClick={handleToggle}
        style={{
          width: 30,
          height: 30,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          background: open ? 'var(--c-surface-2)' : '#ffffff',
          borderColor: open ? 'var(--c-primary)' : 'var(--c-border)',
          color: open ? 'var(--c-primary)' : 'var(--c-muted)',
          cursor: 'pointer',
        }}
      >
        <MoreVertical size={16} />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            className="card"
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: coords.top,
              right: coords.right,
              minWidth: 150,
              zIndex: 9999,
              boxShadow: '0 10px 28px rgba(20, 24, 22, 0.18)',
              padding: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              background: '#ffffff',
              borderRadius: 8,
              border: '1px solid var(--c-border)',
              animation: 'fadeIn 0.12s ease-out',
            }}
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                title={item.title}
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.disabled) return;
                  setOpen(false);
                  item.onClick();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '7px 10px',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  opacity: item.disabled ? 0.45 : 1,
                  color: item.disabled ? 'var(--c-muted)' : (item.color || 'var(--c-text)'),
                  textAlign: 'left',
                  transition: 'background 0.12s, color 0.12s',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled) {
                    e.currentTarget.style.background = 'var(--c-surface-2)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {item.icon && (
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {item.icon}
                  </span>
                )}
                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
