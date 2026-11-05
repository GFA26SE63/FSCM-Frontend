import axios, {
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env } from '../lib/env';
import {
  tokenStore,
  type SessionTokens,
} from '../auth/tokenStore';
import {
  ApiError,
  toApiError,
} from './errors';

interface SessionRequestConfig
  extends InternalAxiosRequestConfig {
  _fscmSessionId?: string;
  _fscmAccessToken?: string;
  _fscmRetried?: boolean;
}

interface RefreshFlight {
  sessionId: string;
  promise: Promise<string>;
}

interface GraphQlEnvelope {
  errors?: Array<{
    extensions?: {
      code?: string;
    };
  }>;
}

export const http = axios.create({
  baseURL: `${env.apiBaseUrl}/api/v1`,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 20_000,
});

// Không dùng shared http cho refresh/logout.
const sessionHttp = axios.create({
  baseURL: `${env.apiBaseUrl}/api/v1/auth`,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 20_000,
});

let refreshFlight: RefreshFlight | null = null;

function sessionChangedError(): ApiError {
  return new ApiError(
    401,
    'Phiên đăng nhập đã thay đổi',
    'Request thuộc phiên cũ không còn hiệu lực.',
  );
}

function expireSession(
  expectedSessionId: string,
): void {
  if (
    tokenStore.getSession()?.id ===
    expectedSessionId
  ) {
    tokenStore.onUnauthorized();
  }
}

function validTokens(
  value: SessionTokens,
): boolean {
  return Boolean(
    value &&
    typeof value.accessToken === 'string' &&
    value.accessToken &&
    typeof value.refreshToken === 'string' &&
    value.refreshToken &&
    Number.isFinite(
      Date.parse(value.accessTokenExpiresAt),
    ) &&
    Number.isFinite(
      Date.parse(value.refreshTokenExpiresAt),
    ),
  );
}

async function performRefresh(
  expectedSessionId: string,
  failedAccessToken: string,
): Promise<string> {
  const current = tokenStore.getSession();

  if (
    !current ||
    current.id !== expectedSessionId
  ) {
    throw sessionChangedError();
  }

  // Một request/tab khác đã refresh xong.
  if (
    current.accessToken !== failedAccessToken &&
    !tokenStore.isAccessExpired(current)
  ) {
    return current.accessToken;
  }

  if (tokenStore.isRefreshExpired(current)) {
    throw new ApiError(
      401,
      'Phiên đăng nhập đã hết hạn',
      'Hãy đăng nhập lại.',
    );
  }

  const response =
    await sessionHttp.post<SessionTokens>(
      '/refresh',
      {
        refreshToken: current.refreshToken,
      },
    );

  const tokens = response.data;

  if (!validTokens(tokens)) {
    throw new ApiError(
      502,
      'Phản hồi refresh không hợp lệ',
      'Backend không trả đủ token và thời hạn phiên.',
    );
  }

  if (
    !tokenStore.rotate(
      expectedSessionId,
      tokens,
    )
  ) {
    // Người dùng đã logout hoặc login account khác
    // trong lúc refresh đang chạy.
    void sessionHttp
      .post('/logout', {
        refreshToken: tokens.refreshToken,
      })
      .catch(() => undefined);

    throw sessionChangedError();
  }

  return tokens.accessToken;
}

function refreshAccessToken(
  sessionId: string,
  failedAccessToken: string,
): Promise<string> {
  if (
    refreshFlight?.sessionId === sessionId
  ) {
    return refreshFlight.promise;
  }

  const run = () =>
    performRefresh(
      sessionId,
      failedAccessToken,
    );

  // Web Locks giúp các tab cùng origin không
  // refresh đồng thời cùng persistent session.
  const promise =
    typeof navigator !== 'undefined' &&
    navigator.locks
      ? navigator.locks.request(
          'fscm.portal.refresh',
          run,
        )
      : run();

  const flight: RefreshFlight = {
    sessionId,
    promise,
  };

  refreshFlight = flight;

  void promise.then(
    () => {
      if (refreshFlight === flight) {
        refreshFlight = null;
      }
    },
    () => {
      if (refreshFlight === flight) {
        refreshFlight = null;
      }
    },
  );

  return promise;
}

async function recoverUnauthorized(
  config: SessionRequestConfig | undefined,
  originalError: ApiError,
): Promise<AxiosResponse> {
  const current = tokenStore.getSession();

  if (!config) {
    tokenStore.onUnauthorized();
    throw originalError;
  }

  if (
    !current ||
    config._fscmSessionId !== current.id
  ) {
    // Không logout phiên mới vì request phiên cũ.
    throw originalError;
  }

  if (config._fscmRetried) {
    expireSession(current.id);
    throw originalError;
  }

  config._fscmRetried = true;

  let accessToken: string;

  try {
    accessToken = await refreshAccessToken(
      current.id,
      config._fscmAccessToken ??
        current.accessToken,
    );
  } catch (error) {
    expireSession(current.id);
    throw toApiError(error);
  }

  if (
    tokenStore.getSession()?.id !== current.id
  ) {
    throw sessionChangedError();
  }

  config.headers.set(
    'Authorization',
    `Bearer ${accessToken}`,
  );

  // Để request retry nằm ngoài catch refresh.
  // Lỗi 500/network của business API không bị
  // hiểu nhầm là refresh thất bại.
  return http.request(config);
}

http.interceptors.request.use(
  async (rawConfig) => {
    const config =
      rawConfig as SessionRequestConfig;

    const session = tokenStore.getSession();

    if (!session) {
      config.headers.delete('Authorization');
      return config;
    }

    if (
      config._fscmSessionId &&
      config._fscmSessionId !== session.id
    ) {
      throw sessionChangedError();
    }

    config._fscmSessionId = session.id;

    let accessToken = session.accessToken;

    if (tokenStore.isAccessExpired(session)) {
      try {
        accessToken =
          await refreshAccessToken(
            session.id,
            session.accessToken,
          );
      } catch (error) {
        expireSession(session.id);
        throw toApiError(error);
      }
    }

    if (
      tokenStore.getSession()?.id !==
      session.id
    ) {
      throw sessionChangedError();
    }

    config._fscmAccessToken = accessToken;

    config.headers.set(
      'Authorization',
      `Bearer ${accessToken}`,
    );

    return config;
  },
);

http.interceptors.response.use(
  (response) => {
    const isGraphQl =
      response.config.url
        ?.split('?')[0]
        .endsWith('/graphql');

    if (isGraphQl) {
      const body =
        response.data as GraphQlEnvelope | null;

      const unauthenticated =
        Array.isArray(body?.errors) &&
        body.errors.some(
          (error) =>
            error.extensions?.code ===
            'AUTH_NOT_AUTHENTICATED',
        );

      if (unauthenticated) {
        return recoverUnauthorized(
          response.config as SessionRequestConfig,
          new ApiError(
            401,
            'Phiên đăng nhập đã hết hạn',
          ),
        );
      }
    }

    return response;
  },

  (error: unknown) => {
    const apiError = toApiError(error);

    if (apiError.status !== 401) {
      return Promise.reject(apiError);
    }

    const config =
      typeof error === 'object' &&
      error !== null &&
      'config' in error
        ? (error.config as
            | SessionRequestConfig
            | undefined)
        : undefined;

    return recoverUnauthorized(
      config,
      apiError,
    );
  },
);

export const get = <T>(
  url: string,
  params?: object,
) =>
  http
    .get<T>(url, { params })
    .then((response) => response.data);

export const post = <T = void>(
  url: string,
  body?: unknown,
) =>
  http
    .post<T>(url, body)
    .then((response) => response.data);

export const put = <T = void>(
  url: string,
  body?: unknown,
) =>
  http
    .put<T>(url, body)
    .then((response) => response.data);

export const patch = <T = void>(
  url: string,
  body?: unknown,
) =>
  http
    .patch<T>(url, body)
    .then((response) => response.data);

export const del = <T = void>(
  url: string,
) =>
  http
    .delete<T>(url)
    .then((response) => response.data);

// Giữ nguyên behaviour hiện tại của các list API.
// Pagination không thuộc thay đổi auth này.
export const getAll = <T>(
  url: string,
  params?: object,
) =>
  http
    .get<{ items: T[] } | T[]>(url, {
      params: {
        size: 500,
        ...params,
      },
    })
    .then((response) =>
      Array.isArray(response.data)
        ? response.data
        : (response.data?.items ?? []),
    );