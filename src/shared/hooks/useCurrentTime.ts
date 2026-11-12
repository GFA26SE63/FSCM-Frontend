import { useEffect, useState } from 'react';

/** Refresh scheduled-status labels and date boundaries while the page stays open. */
export function useCurrentTime(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  return now;
}
