import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import {
  assertPermission,
  type Permission,
} from '../auth/permissions';
import {
  toApiError,
  type ApiError,
} from '../api/errors';
import { useToast } from '../ui/Toast';

interface Options<TData, TVars> {
  permission?: Permission;
  /** Opt in only when this mutation has no clearer inline/page feedback. */
  notify?: boolean;
  success?: string | ((data: TData, vars: TVars) => string);
  onSuccess?: (data: TData, vars: TVars) => void;
}

export function useApiMutation<
  TVars = void,
  TData = unknown,
>(
  fn: (vars: TVars) => Promise<TData>,
  options: Options<TData, TVars> = {},
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();

  return useMutation<TData, ApiError, TVars>({
    mutationFn: async (vars) => {
      try {
        if (options.permission) {
          assertPermission(user, options.permission);
        }

        return await fn(vars);
      } catch (error) {
        throw toApiError(error);
      }
    },

    onSuccess: (data, vars) => {
      void queryClient.invalidateQueries();

      const message =
        typeof options.success === 'function'
          ? options.success(data, vars)
          : options.success;

      // Network code never owns user feedback. A feature must explicitly opt
      // in with a success message (or notify: true) when its UI does not
      // already acknowledge the result inline or by updating the page.
      const shouldNotify = options.notify ?? message !== undefined;
      if (shouldNotify) toast.mutationSuccess(message);

      options.onSuccess?.(data, vars);
    },

    onError: (error) => {
      const shouldNotify = options.notify ?? options.success !== undefined;
      if (shouldNotify) toast.mutationError(error);
    },
  });
}
