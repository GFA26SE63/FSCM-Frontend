import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { errorMessage } from '../api/errors';

interface ToastItem {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

interface ToastApi {
  show: (text: string) => void;
  error: (err: unknown) => void;
  mutationSuccess: (text?: string) => void;
  mutationError: (err: unknown) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const active = useRef<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingErrors = useRef<ToastItem[]>([]);
  const recent = useRef(new Map<string, number>());
  const mounted = useRef(true);

  useEffect(() => () => {
    mounted.current = false;
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const fingerprint = (text: string, tone: ToastItem['tone']) => `${tone}:${text.trim()}`;
  function dismiss(id: number) {
    if (active.current?.id !== id) return;
    active.current = null;
    timer.current = null;
    if (mounted.current) setItems([]);
    const next = pendingErrors.current.shift();
    if (next) {
      active.current = next;
      if (mounted.current) setItems([next]);
      timer.current = setTimeout(() => dismiss(next.id), 6000);
    }
  }

  function push(text: string, tone: ToastItem['tone']) {
    const normalized = text.trim();
    if (!normalized) return;
    const now = Date.now();
    const key = fingerprint(normalized, tone);
    for (const [seen, at] of recent.current) {
      if (now - at >= 3000) recent.current.delete(seen);
    }
    if (
      recent.current.has(key) ||
      (active.current && fingerprint(active.current.text, active.current.tone) === key) ||
      pendingErrors.current.some((item) => fingerprint(item.text, item.tone) === key)
    ) return;
    recent.current.set(key, now);
    const id = ++seq;
    const item = { id, text: normalized, tone };
    if (tone === 'error' && active.current?.tone === 'error') {
      pendingErrors.current.push(item);
      return;
    }
    if (tone === 'info' && active.current) return;
    if (timer.current) clearTimeout(timer.current);
    active.current = item;
    if (mounted.current) setItems([item]);
    timer.current = setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 4000);
  }
  const api: ToastApi = {
    show: (t) => push(t, 'info'),
    error: (e) => push(errorMessage(e), 'error'),
    mutationSuccess: (t) => push(t ?? 'Thao tác thành công.', 'info'),
    mutationError: (e) => push(errorMessage(e), 'error'),
  };
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast${t.tone === 'error' ? ' error' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
