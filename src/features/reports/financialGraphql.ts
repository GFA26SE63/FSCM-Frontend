import { graphql } from '@/shared/api/graphql';
import type { PageInfo } from '@/shared/pagination/types';

/**
 * Read contracts for the Financial Reports page (GraphQL entities.salesOrders / entities.writeOffs).
 * No aggregation exists in these contracts, so money totals are NOT computed here:
 * only the server-side totalCount and row lists are exposed.
 */
export const FINANCIAL_PAGE_SIZE = 10;
export interface PageArgs { before?: string; size?: number }

export interface FinancialFilters { from: string; to: string; retailerId: string; warehouseId: string }

const nextDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

/** Vietnam-local [from 00:00, to+1 00:00): `to` is inclusive for the user, exclusive in the query. */
export const dateRange = (from: string, to: string) => ({
  from: `${from}T00:00:00+07:00`,
  toExclusive: `${nextDay(to)}T00:00:00+07:00`,
});

function build(
  connection: 'salesOrders' | 'writeOffs',
  nodeFields: string,
  f: FinancialFilters,
  extra: { field: string; decl: string; value: string }[],
  after?: string,
  args: PageArgs = {},
) {
  const r = dateRange(f.from, f.to);
  const conditions = ['{ createdAt: { gte: $from } }', '{ createdAt: { lt: $to } }'];
  const declarations = ['$from: DateTime!', '$to: DateTime!'];
  const variables: Record<string, unknown> = { from: r.from, to: r.toExclusive };
  for (const e of extra) {
    if (!e.value) continue;
    conditions.push(`{ ${e.field}: { eq: $${e.field} } }`);
    declarations.push(`$${e.field}: ${e.decl}`);
    variables[e.field] = e.value;
  }
  const size = args.size ?? FINANCIAL_PAGE_SIZE;
  if (args.before) {
    declarations.push('$before: String!');
    variables.before = args.before;
  } else if (after) {
    declarations.push('$after: String!');
    variables.after = after;
  }
  const paging = args.before ? `last: ${size}, before: $before` : `first: ${size}${after ? ', after: $after' : ''}`;
  const query = `query Financial_${connection}(${declarations.join(', ')}) {
  entities {
    page: ${connection}(${paging}, where: { and: [${conditions.join(', ')}] }, order: [{ createdAt: DESC }, { id: DESC }]) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      nodes { ${nodeFields} }
    }
  }
}`;
  return { query, variables };
}

export const buildOrdersQuery = (f: FinancialFilters, after?: string, args?: PageArgs) =>
  build('salesOrders', 'id orderCode retailerCodeSnapshot retailerNameSnapshot status finalAmount createdAt', f,
    [{ field: 'retailerId', decl: 'UUID!', value: f.retailerId }], after, args);

export const buildWriteOffsQuery = (f: FinancialFilters, after?: string, args?: PageArgs) =>
  build('writeOffs', 'id writeOffCode warehouseId status reason createdAt', f,
    [{ field: 'warehouseId', decl: 'UUID!', value: f.warehouseId }], after, args);

export interface FinancialOrderRow {
  id: string; orderCode: string; retailerCodeSnapshot: string; retailerNameSnapshot: string;
  status: string; finalAmount: number; createdAt: string;
}
export interface FinancialWriteOffRow {
  id: string; writeOffCode: string; warehouseId: string; status: string; reason: string | null; createdAt: string;
}
export interface FinancialPage<T> { rows: T[]; totalCount: number; pageInfo: PageInfo }

async function run<T>(built: { query: string; variables: Record<string, unknown> }): Promise<FinancialPage<T>> {
  const data = await graphql<{ entities: { page: { nodes: T[]; totalCount: number; pageInfo: PageInfo } } }>(built.query, built.variables);
  const p = data.entities?.page;
  if (!p || !Array.isArray(p.nodes) || typeof p.totalCount !== 'number') throw new Error('Phản hồi báo cáo thiếu dữ liệu.');
  return { rows: p.nodes, totalCount: p.totalCount, pageInfo: p.pageInfo };
}

export const fetchFinancialOrders = (f: FinancialFilters, after?: string, args?: PageArgs) => run<FinancialOrderRow>(buildOrdersQuery(f, after, args));
export const fetchFinancialWriteOffs = (f: FinancialFilters, after?: string, args?: PageArgs) => run<FinancialWriteOffRow>(buildWriteOffsQuery(f, after, args));
