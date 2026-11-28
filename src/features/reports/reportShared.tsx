import { useEffect, useState } from 'react';
import { Callout } from '@/shared/ui';

export function useDebounced<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function ReportNotes({ scope, notes }: { scope?: string; notes?: string[] }) {
  if (!scope && (!notes || notes.length === 0)) return null;
  return (
    <div className="report-notes">
      {scope && <div><strong>Phạm vi dữ liệu:</strong> {scope}</div>}
      {notes && notes.length > 0 && (
        <ul>
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}

export function ExportErrorCallout({ message }: { message: string }) {
  return message ? <Callout tone="danger">{message}</Callout> : null;
}
