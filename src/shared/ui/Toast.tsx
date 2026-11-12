import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
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
  const pendingMutation = useRef<ReturnType<typeof setTimeout> | null>(null);
  const push = useCallback((text: string, tone: ToastItem['tone']) => {
    const id = ++seq;
    setItems((s) => [...s.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 4000);
  }, []);
  const clearPendingMutation = useCallback(() => {
    if (pendingMutation.current) clearTimeout(pendingMutation.current);
    pendingMutation.current = null;
  }, []);
  const deferMutation = useCallback((text: string, tone: ToastItem['tone']) => {
    clearPendingMutation();
    pendingMutation.current = setTimeout(() => {
      pendingMutation.current = null;
      push(text, tone);
    }, 180);
  }, [clearPendingMutation, push]);
  const api = useMemo<ToastApi>(() => ({
    show: (t) => { clearPendingMutation(); push(t, 'info'); },
    error: (e) => { clearPendingMutation(); push(errorMessage(e), 'error'); },
    mutationSuccess: (t) => deferMutation(t ?? 'Thao tác thành công.', 'info'),
    mutationError: (e) => deferMutation(errorMessage(e), 'error'),
  }), [clearPendingMutation, deferMutation, push]);
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
