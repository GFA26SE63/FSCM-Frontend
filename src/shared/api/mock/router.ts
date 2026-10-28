/**
 * Tiny in-browser "server" router used by the mock adapter.
 * Handlers mirror the REST routes of SPEC §8 (relative to /api/v1) and return plain JSON objects.
 */
export interface MockRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  token: string | null;
}

export type MockHandler = (req: MockRequest) => unknown;

/** Throw from a handler to produce an RFC 7807 ProblemDetails response. */
export class MockHttpError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail?: string,
    public errors?: Record<string, string[]>,
    public code?: string,
  ) {
    super(detail ?? title);
  }
}

export const notFound = (what: string) => new MockHttpError(404, 'Không tìm thấy dữ liệu', `${what} không tồn tại.`);
export const conflict = (detail: string) => new MockHttpError(409, 'Xung đột trạng thái', detail);
export const businessRule = (detail: string, code?: string) => new MockHttpError(422, 'Vi phạm quy tắc nghiệp vụ', detail, undefined, code);
export const validation = (errors: Record<string, string[]>) =>
  new MockHttpError(400, 'Dữ liệu không hợp lệ', Object.values(errors)[0]?.[0], errors, 'validation');

interface Route {
  method: string;
  regex: RegExp;
  keys: string[];
  handler: MockHandler;
}

export class MockRouter {
  private routes: Route[] = [];

  on(method: string, pattern: string, handler: MockHandler): this {
    const keys: string[] = [];
    const regex = new RegExp(
      '^' +
        pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, (_, k: string) => {
          keys.push(k);
          return '([^/]+)';
        }) +
        '$',
    );
    this.routes.push({ method: method.toUpperCase(), regex, keys, handler });
    return this;
  }
  get = (p: string, h: MockHandler) => this.on('GET', p, h);
  post = (p: string, h: MockHandler) => this.on('POST', p, h);
  put = (p: string, h: MockHandler) => this.on('PUT', p, h);
  patch = (p: string, h: MockHandler) => this.on('PATCH', p, h);
  delete = (p: string, h: MockHandler) => this.on('DELETE', p, h);

  match(method: string, path: string): { handler: MockHandler; params: Record<string, string> } | null {
    for (const r of this.routes) {
      if (r.method !== method.toUpperCase()) continue;
      const m = r.regex.exec(path);
      if (m) return { handler: r.handler, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }
}

/** Server-side paging helper: ?page=&size=&search= */
export function paginate<T>(items: T[], query: Record<string, string>, searchText?: (x: T) => string) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.max(1, Math.min(500, Number(query.size) || 500));
  const q = (query.search ?? '').trim().toLowerCase();
  const filtered = q && searchText ? items.filter((x) => searchText(x).toLowerCase().includes(q)) : items;
  return { items: filtered.slice((page - 1) * size, page * size), page, size, total: filtered.length };
}
