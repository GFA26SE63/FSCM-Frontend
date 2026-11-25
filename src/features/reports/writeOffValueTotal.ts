import { graphql } from '@/shared/api/graphql';
import type { PageInfo } from '@/shared/pagination/types';
import { dateRange, type FinancialFilters } from './financialGraphql';
import { toMinor } from './orderValueTotal';

/**
 * "Giá trị hàng hủy" = sum(item.quantity x ProductPrice.unitPrice) where the price is the version in force
 * (effectiveFrom <= createdAt < effectiveTo|open) at the write-off document's creation time.
 * Money is summed in integer 1/100 units (quantity is scaled to 1/1000 first so decimals stay exact).
 * Any missing batch / price version / invalid number => incomplete (never a partial or zero total).
 */
export const WRITE_OFF_MAX_DOCS = 1000;
const PAGE = 200;
const CHUNK = 50;

export type WriteOffValueResult =
  | { status: 'ok'; docCount: number; amountMinor: number }
  | { status: 'too-large'; docCount: number }
  | { status: 'incomplete'; reason: string };

type Gql = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
interface Conn<T> { totalCount: number; pageInfo: PageInfo; nodes: T[] }
interface Doc { id: string; createdAt: string }
interface Item { id: string; writeOffId: string; batchId: string; quantity: number }
interface Batch { id: string; productId: string }
interface Price { id: string; productId: string; unitPrice: number; effectiveFrom: string; effectiveTo: string | null }

export function buildWriteOffDocsQuery(f: FinancialFilters, after?: string) {
  const r = dateRange(f.from, f.to);
  const conds = ['{ createdAt: { gte: $from } }', '{ createdAt: { lt: $to } }'];
  const decl = ['$from: DateTime!', '$to: DateTime!'];
  const vars: Record<string, unknown> = { from: r.from, to: r.toExclusive };
  if (f.warehouseId) { conds.push('{ warehouseId: { eq: $warehouseId } }'); decl.push('$warehouseId: UUID!'); vars.warehouseId = f.warehouseId; }
  if (after) { decl.push('$after: String!'); vars.after = after; }
  return {
    query: `query WriteOffValueDocs(${decl.join(', ')}) { entities { page: writeOffs(first: ${PAGE}${after ? ', after: $after' : ''}, where: { and: [${conds.join(', ')}] }, order: [{ id: ASC }]) { totalCount pageInfo { hasNextPage endCursor } nodes { id createdAt } } } }`,
    variables: vars,
  };
}

/** Reads every page of one connection; null when the connection reports inconsistent data. */
async function readAll<T extends { id: string }>(run: Gql, make: (after?: string) => { query: string; variables: Record<string, unknown> }, max: number):
  Promise<{ rows: Map<string, T>; total: number } | 'too-large' | null> {
  const rows = new Map<string, T>();
  let after: string | undefined;
  let total: number | null = null;
  for (let guard = 0; guard < Math.ceil(max / PAGE) + 2; guard++) {
    const { query, variables } = make(after);
    const data = await run<{ entities: { page: Conn<T> } }>(query, variables);
    const p = data.entities?.page;
    if (!p || !Array.isArray(p.nodes) || typeof p.totalCount !== 'number' || !p.pageInfo) return null;
    if (total === null) { total = p.totalCount; if (total > max) return 'too-large'; } else if (p.totalCount !== total) return null;
    for (const n of p.nodes) rows.set(n.id, n);
    if (!p.pageInfo.hasNextPage) return rows.size === total ? { rows, total } : null;
    after = p.pageInfo.endCursor ?? undefined;
    if (!after) return null;
  }
  return null;
}

const idsQuery = (conn: string, fields: string, ids: string[], after?: string) => ({
  query: `query WriteOffValue_${conn}($ids: [UUID!]!${after ? ', $after: String!' : ''}) { entities { page: ${conn}(first: ${PAGE}${after ? ', after: $after' : ''}, where: { ${conn === 'writeOffItems' ? 'writeOffId' : conn === 'batches' ? 'id' : 'productId'}: { in: $ids } }, order: [{ id: ASC }]) { totalCount pageInfo { hasNextPage endCursor } nodes { id ${fields} } } } }`,
  variables: { ids, ...(after ? { after } : {}) },
});

async function readByIds<T extends { id: string }>(run: Gql, conn: string, fields: string, ids: string[]): Promise<T[] | null> {
  const out = new Map<string, T>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    const res = await readAll<T>(run, after => idsQuery(conn, fields, part, after), 100000);
    if (res === null || res === 'too-large') return null;
    for (const [k, v] of res.rows) out.set(k, v);
  }
  return [...out.values()];
}

export async function fetchWriteOffValueTotal(f: FinancialFilters, run: Gql = graphql, maxDocs = WRITE_OFF_MAX_DOCS): Promise<WriteOffValueResult> {
  const docsRes = await readAll<Doc>(run, after => buildWriteOffDocsQuery(f, after), maxDocs);
  if (docsRes === 'too-large') return { status: 'too-large', docCount: maxDocs + 1 };
  if (!docsRes) return { status: 'incomplete', reason: 'Dữ liệu phiếu hủy không đầy đủ.' };
  const docs = docsRes.rows;
  if (docs.size === 0) return { status: 'ok', docCount: 0, amountMinor: 0 };

  const items = await readByIds<Item>(run, 'writeOffItems', 'writeOffId batchId quantity', [...docs.keys()]);
  if (!items) return { status: 'incomplete', reason: 'Không đọc đủ dòng phiếu hủy.' };
  const batches = await readByIds<Batch>(run, 'batches', 'productId', [...new Set(items.map(i => i.batchId))]);
  if (!batches) return { status: 'incomplete', reason: 'Không đọc đủ thông tin lô hàng.' };
  const batchProduct = new Map(batches.map(b => [b.id, b.productId]));
  const prices = await readByIds<Price>(run, 'productPrices', 'productId unitPrice effectiveFrom effectiveTo', [...new Set(batches.map(b => b.productId))]);
  if (!prices) return { status: 'incomplete', reason: 'Không đọc đủ phiên bản giá.' };

  let amountMinor = 0;
  for (const it of items) {
    const doc = docs.get(it.writeOffId);
    const productId = batchProduct.get(it.batchId);
    const t = doc ? Date.parse(doc.createdAt) : NaN;
    if (!doc || !productId || !Number.isFinite(t) || typeof it.quantity !== 'number' || !Number.isFinite(it.quantity)) {
      return { status: 'incomplete', reason: 'Dòng phiếu hủy thiếu dữ liệu.' };
    }
    const version = prices
      .filter(p => p.productId === productId && Date.parse(p.effectiveFrom) <= t && (!p.effectiveTo || Date.parse(p.effectiveTo) > t))
      .sort((a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom))[0];
    const unitMinor = version ? toMinor(version.unitPrice) : null;
    if (unitMinor === null) return { status: 'incomplete', reason: 'Thiếu giá tại thời điểm lập phiếu.' };
    amountMinor += Math.round((Math.round(it.quantity * 1000) * unitMinor) / 1000);
  }
  return { status: 'ok', docCount: docs.size, amountMinor };
}

/** Backend stores the disposal reason as JSON ({Method, RequestHash, Operation}); show only the readable method. */
export function writeOffReasonText(reason: string | null): string {
  if (!reason) return '—';
  try {
    const v: unknown = JSON.parse(reason);
    if (v && typeof v === 'object') {
      const method = (v as { Method?: unknown }).Method;
      return typeof method === 'string' && method ? method : '—';
    }
  } catch { /* plain-text reason */ }
  return reason;
}
