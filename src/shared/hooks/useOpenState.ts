import { useState } from 'react';

/** Tiny helper for dialog open/close state keyed by a record (null = closed). */
export function useOpenState<T = true>() {
  const [value, setValue] = useState<T | null>(null);
  return { value, open: (v: T = true as T) => setValue(v), close: () => setValue(null), isOpen: value !== null };
}
