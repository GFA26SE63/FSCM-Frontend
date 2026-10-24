import { db } from '../fixtures';
import type { DbOrder, DbProduct, DbRetailer, DbWarehouse } from '../fixtures/types';
import { MockHttpError, notFound, type MockRequest } from '../router';

export const product = (sku: string): DbProduct => db.products.find((p) => p.sku === sku) ?? notFoundThrow(`Sản phẩm ${sku}`);
export const warehouse = (code: string): DbWarehouse => db.warehouses.find((w) => w.code === code) ?? notFoundThrow(`Kho ${code}`);
export const retailer = (code: string): DbRetailer => db.retailers.find((r) => r.code === code) ?? notFoundThrow(`Retailer ${code}`);
export const order = (code: string): DbOrder => db.orders.find((o) => o.code === code) ?? notFoundThrow(`Đơn ${code}`);
export const warehouseName = (code: string) => db.warehouses.find((w) => w.code === code)?.name ?? code;
export const areaName = (code: string) => db.areas.find((a) => a.code === code)?.name ?? code;

function notFoundThrow(what: string): never {
  throw notFound(what);
}

/** Decodes the mock bearer token ("mock.<base64 json>") issued by POST /auth/mock-token. */
export function actor(req: MockRequest): { name: string; role: string; email: string } {
  try {
    const raw = (req.token ?? '').replace(/^mock\./, '');
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch {
    return { name: 'Hệ thống', role: 'Admin', email: '' };
  }
}
export const encodeToken = (payload: object) => 'mock.' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));

const ROLE_VI: Record<string, string> = { Admin: 'Admin', Operator: 'Operator', WarehouseKeeper: 'Warehouse Keeper', SalesManager: 'Sales Manager' };
export const actorLabel = (req: MockRequest) => {
  const a = actor(req);
  return `${a.name} (${ROLE_VI[a.role] ?? a.role})`;
};

export const requireRole = (req: MockRequest, roles: string[]) => {
  const a = actor(req);
  if (!roles.includes(a.role)) throw new MockHttpError(403, 'Bạn không có quyền thực hiện thao tác này', `Vai trò ${a.role} không được phép.`);
};

export const searchOf = (...parts: (string | number | null | undefined)[]) => parts.filter((x) => x != null).join(' ');
export const nextSeq = (codes: string[], prefix: string, width: number) => {
  const max = codes.filter((c) => c.startsWith(prefix)).reduce((m, c) => Math.max(m, Number(c.slice(prefix.length)) || 0), 0);
  return prefix + String(max + 1).padStart(width, '0');
};

/**
 * A stable fake GUID for a business code, so mock responses can be keyed the way the real API is
 * (run-side endpoints take identifiers, not codes). Deterministic, so a reload keeps the same id.
 */
export const mockGuid = (seed: string): string => {
  let h = 0x811c9dc5;
  const hex: string[] = [];
  for (let i = 0; i < 32; i++) {
    h ^= seed.charCodeAt(i % seed.length) + i * 31;
    h = Math.imul(h, 0x01000193) >>> 0;
    hex.push(((h >>> (i % 4) * 4) & 0xf).toString(16));
  }
  const g = hex.join('');
  return `${g.slice(0, 8)}-${g.slice(8, 12)}-${g.slice(12, 16)}-${g.slice(16, 20)}-${g.slice(20, 32)}`;
};

export const orderById = (id: string): DbOrder =>
  db.orders.find((o) => mockGuid(o.code) === id) ?? notFoundThrow(`Đơn ${id}`);
