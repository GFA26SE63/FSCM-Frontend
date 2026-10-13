import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { MockHttpError, MockRouter } from './router';
import { registerIdentity } from './handlers/identity';
import { registerCatalog } from './handlers/catalog';
import { registerPartners } from './handlers/partners';
import { registerLogistics } from './handlers/logistics';
import { registerInventory } from './handlers/inventory';
import { registerOrdering } from './handlers/ordering';
import { registerPricing } from './handlers/pricing';
import { registerFinance } from './handlers/finance';
import { registerLoyalty } from './handlers/loyalty';
import { registerPerformance } from './handlers/performance';

/**
 * Mock mode (VITE_USE_MOCK=true, default): an axios adapter that answers /api/v1/* in the browser from an
 * in-memory database seeded with the prototype data (fixtures/). Business engines (allocation B1–B4,
 * rotation planner, pricing, transit) run in engines/ so screens show the same numbers as Portal.dc.html.
 * State lives until the page is reloaded.
 */
const router = new MockRouter();
[registerIdentity, registerCatalog, registerPartners, registerLogistics, registerInventory, registerOrdering, registerPricing, registerFinance, registerLoyalty, registerPerformance].forEach((r) => r(router));

const LATENCY_MS = 180;

const problem = (status: number, title: string, detail?: string, errors?: Record<string, string[]>, code?: string) => ({
  type: `https://httpstatuses.io/${status}`,
  title,
  status,
  detail,
  code,
  errors,
  traceId: 'mock-' + Math.random().toString(16).slice(2, 10),
});

export const mockAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const base = config.baseURL ?? '';
  let url = config.url ?? '';
  if (url.startsWith(base)) url = url.slice(base.length);
  const [rawPath, qs] = url.split('?');
  const path = rawPath.replace(/\/+$/, '') || '/';
  const query: Record<string, string> = {};
  new URLSearchParams(qs ?? '').forEach((v, k) => (query[k] = v));
  Object.entries((config.params ?? {}) as Record<string, unknown>).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query[k] = String(v);
  });
  const body = typeof config.data === 'string' && config.data ? JSON.parse(config.data) : config.data;
  const auth = AxiosHeaders.from(config.headers).get('Authorization');
  const token = typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '') : null;
  const method = (config.method ?? 'get').toUpperCase();

  await new Promise((r) => setTimeout(r, LATENCY_MS));

  const respond = (status: number, data: unknown): AxiosResponse => ({
    data,
    status,
    statusText: String(status),
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
    config,
    request: { mock: true },
  });

  const match = router.match(method, path);
  if (!match) {
    const res = respond(404, problem(404, 'Không tìm thấy endpoint', `${method} /api/v1${path} chưa có trong mock.`));
    throw new AxiosError('Not found', 'ERR_BAD_REQUEST', config, res.request, res);
  }
  if (path !== '/auth/mock-token' && !token) {
    const res = respond(401, problem(401, 'Chưa đăng nhập'));
    throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, res.request, res);
  }
  try {
    const data = match.handler({ method, path, params: match.params, query, body, token });
    // Return a deep copy so UI code can never mutate the in-memory DB.
    return respond(data === undefined ? 204 : 200, data === undefined ? '' : JSON.parse(JSON.stringify(data)));
  } catch (e) {
    const err = e instanceof MockHttpError ? e : new MockHttpError(500, 'Lỗi hệ thống (mock)', e instanceof Error ? e.message : String(e));
    if (!(e instanceof MockHttpError)) console.error('[mock]', e);
    const res = respond(err.status, problem(err.status, err.title, err.detail, err.errors, err.code));
    throw new AxiosError(err.title, 'ERR_BAD_RESPONSE', config, res.request, res);
  }
};

export function installMock(instance: AxiosInstance) {
  instance.defaults.adapter = mockAdapter;
  console.info('%c[FSCM] Mock API enabled (VITE_USE_MOCK=true)', 'color:#14655B;font-weight:600');
}
