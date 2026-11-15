import { useEffect, useLayoutEffect, useRef } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { isReturnToListState, rememberLocation } from '@/shared/router/listState';

const RESTORE_TIMEOUT_MS = 3000;
const SCROLL_MEMORY_LIMIT = 100;

/** Vị trí cuộn theo URL đầy đủ (đường dẫn + bộ lọc) trong phiên làm việc hiện tại. */
const scrollMemory = new Map<string, number>();

function saveScroll(key: string, top: number) {
  scrollMemory.delete(key);
  scrollMemory.set(key, top);
  if (scrollMemory.size > SCROLL_MEMORY_LIMIT) {
    const oldest = scrollMemory.keys().next().value;
    if (oldest !== undefined) scrollMemory.delete(oldest);
  }
}

/**
 * Gắn vào vùng cuộn chính (.page):
 *  - ghi nhớ query string của từng màn hình để "Quay lại" khôi phục đúng bộ lọc;
 *  - lưu vị trí cuộn và khôi phục khi quay lại danh sách (Back của trình duyệt,
 *    nút Quay lại, breadcrumb); mở màn hình mới thì cuộn lên đầu.
 */
export function useListContextRestoration() {
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const history = useHistory();
  const currentKey = useRef(location.pathname + location.search);
  const previousPath = useRef<string | null>(null);
  const restoring = useRef<(() => void) | null>(null);

  useEffect(() => {
    rememberLocation(location.pathname, location.search);
  }, [location.pathname, location.search]);

  // Lưu vị trí cuộn của URL hiện tại.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      if (!restoring.current) saveScroll(currentKey.current, el.scrollTop);
    };
    const stopRestore = () => restoring.current?.();
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', stopRestore, { passive: true });
    el.addEventListener('touchstart', stopRestore, { passive: true });
    el.addEventListener('keydown', stopRestore);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', stopRestore);
      el.removeEventListener('touchstart', stopRestore);
      el.removeEventListener('keydown', stopRestore);
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    const key = location.pathname + location.search;
    const samePage = previousPath.current === location.pathname;
    previousPath.current = location.pathname;
    currentKey.current = key;
    if (!el || samePage) return; // đổi bộ lọc trên cùng màn hình: giữ nguyên vị trí cuộn

    restoring.current?.();
    const returning = history.action === 'POP' || isReturnToListState(location.state);
    const target = returning ? scrollMemory.get(key) ?? 0 : 0;
    if (target <= 0) {
      el.scrollTop = 0;
      return;
    }

    // Dữ liệu danh sách có thể đang tải: chờ nội dung đủ cao rồi mới đặt vị trí cuộn.
    let frame = 0;
    const started = performance.now();
    const stop = () => {
      cancelAnimationFrame(frame);
      restoring.current = null;
    };
    const tick = () => {
      el.scrollTop = target;
      const reachable = el.scrollHeight - el.clientHeight >= target;
      if (reachable || performance.now() - started > RESTORE_TIMEOUT_MS) {
        stop();
        saveScroll(key, el.scrollTop);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    restoring.current = stop;
    tick();
    return stop;
  }, [location.pathname, location.search, location.state, history]);

  return ref;
}
