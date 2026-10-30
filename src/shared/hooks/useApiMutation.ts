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

      if (message) toast.show(message);

      options.onSuccess?.(data, vars);
    },

    onError: (error) => {
      toast.error(error);
    },
  });
}