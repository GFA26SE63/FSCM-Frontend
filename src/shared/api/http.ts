import axios from 'axios';
import { env } from '../lib/env';
import { tokenStore } from '../auth/tokenStore';
import { toApiError } from './errors';

/**
 * The single axios instance. Every feature api.ts goes through it:
 *  - baseURL = VITE_API_BASE_URL + /api/v1
 *  - Authorization: Bearer <FSCM JWT>
 *  - errors are mapped from ProblemDetails to ApiError
 * Provider ID tokens are exchanged during sign-in and are never attached to business API requests.
 * In mock mode (VITE_USE_MOCK=true) main.tsx installs the in-browser adapter from ./mock before rendering.
 */
export const http = axios.create({
  baseURL: `${env.apiBaseUrl}/api/v1`,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  timeout: 20_000,
});

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const apiError = toApiError(err);
    if (apiError.status === 401) tokenStore.onUnauthorized();
    return Promise.reject(apiError);
  },
);

/** Small helpers so api.ts files stay one-liners. */
export const get = <T>(url: string, params?: object) => http.get<T>(url, { params }).then((r) => r.data);
export const post = <T = void>(url: string, body?: unknown) => http.post<T>(url, body).then((r) => r.data);
export const put = <T = void>(url: string, body?: unknown) => http.put<T>(url, body).then((r) => r.data);
export const del = <T = void>(url: string) => http.delete<T>(url).then((r) => r.data);

/** GET a paged collection and return every item (list screens page/filter on the client with DataTable). */
export const getAll = <T>(url: string, params?: object) =>
  http.get<{ items: T[] }>(url, { params: { size: 500, ...params } }).then((r) => r.data.items);
