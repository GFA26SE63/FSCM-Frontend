import type { ReactNode } from 'react';

export type CalloutTone = 'danger' | 'warn' | 'info' | 'ok' | 'neutral';

/** Coloured notice box (rejection reason, promotion change, form errors …). */
export function Callout({ tone = 'info', children }: { tone?: CalloutTone; children: ReactNode }) {
  return <div className={`callout callout-${tone}`}>{children}</div>;
}
