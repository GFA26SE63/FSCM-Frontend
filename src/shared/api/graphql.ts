import { http } from './http';
import { ApiError } from './errors';
import { env } from '../lib/env';
import { tokenStore } from '../auth/tokenStore';

interface GraphQlError {
  message: string;
  extensions?: {
    code?: string;
  };
}

interface GraphQlResponse<T> {
  data?: T | null;
  errors?: GraphQlError[];
}

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const response = await http.post<GraphQlResponse<T>>(
    '/graphql',
    { query, variables },
    { baseURL: env.apiBaseUrl },
  );

  const { data, errors } = response.data;

  if (errors?.length) {
    const code = errors[0].extensions?.code;
    const status =
      code === 'AUTH_NOT_AUTHENTICATED'
        ? 401
        : code === 'AUTH_NOT_AUTHORIZED'
          ? 403
          : 400;

    if (status === 401) tokenStore.onUnauthorized();

    throw new ApiError(
      status,
      'Không tải được dữ liệu',
      errors.map((error) => error.message).join('\n'),
      code,
    );
  }

  if (data == null) {
    throw new ApiError(
      502,
      'Phản hồi không hợp lệ',
      'GraphQL không trả dữ liệu.',
    );
  }

  return data;
}