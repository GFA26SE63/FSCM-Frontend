import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { errorMessage } from '../api/errors';

/** Renders loading / error for a react-query result, children when data is ready. */
export function QueryState<T>({ query, children }: { query: { isLoading: boolean; error: unknown; data: T | undefined }; children: (data: T) => ReactNode }) {
  if (query.isLoading)
    return (
      <div className="loading">
        <span className="spinner" /> Đang tải dữ liệu…
      </div>
    );
  if (query.error) return <EmptyState title="Không tải được dữ liệu" description={errorMessage(query.error)} />;
  if (query.data === undefined) return null;
  return <>{children(query.data)}</>;
}
