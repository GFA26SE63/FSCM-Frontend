import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '../api/errors';
import { useToast } from '../ui/Toast';

interface Options<TData, TVars> {
  /** Toast text on success (string or built from the result). */
  success?: string | ((data: TData, vars: TVars) => string);
  onSuccess?: (data: TData, vars: TVars) => void;
}

/**
 * Mutation wrapper used by every feature hooks.ts:
 *  - invalidates every cached query on success (lists, details, badges all depend on the same server state),
 *  - shows a success toast, and an error toast mapped from ProblemDetails (ApiError) on failure.
 */
export function useApiMutation<TVars = void, TData = unknown>(fn: (vars: TVars) => Promise<TData>, options: Options<TData, TVars> = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<TData, ApiError, TVars>({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      void qc.invalidateQueries();
      const msg = typeof options.success === 'function' ? options.success(data, vars) : options.success;
      if (msg) toast.show(msg);
      options.onSuccess?.(data, vars);
    },
    onError: (err) => toast.error(err),
  });
}
