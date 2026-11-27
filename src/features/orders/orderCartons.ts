import { graphql } from '@/shared/api/graphql';

interface Connection<T> {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}
interface OrderCartonLine {
  id: string; documentId: string; sku: string; productName: string;
}
interface IssueDocument { id: string; code: string; warehouseId: string }
interface DocumentCarton { id: string; documentId: string; lineId: string; cartonId: string; scannedAt: string | null }
export interface OrderCarton extends DocumentCarton {
  sku: string; productName: string; warehouseId: string; documentCode: string;
}

// Each collection is cursor-paged. Use the issue snapshot, rather than counting
// the same carton again on its source picking document. Scope stays server-side.
async function pages<T>(field: string, selection: string, where: string): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let after: string | null = null;
  for (;;) {
    const data: { entities: Record<string, Connection<T>> } = await graphql(`
      query OrderCartons($after: String) {
        entities { ${field}(first: 100, after: $after, where: ${where}, order: [{ id: ASC }]) {
          nodes { ${selection} } pageInfo { hasNextPage endCursor }
        } }
      }`, { after });
    const page = data.entities[field];
    if (!Array.isArray(page?.nodes) || !page.pageInfo) throw new Error('Không tải được danh sách thùng.');
    rows.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) return rows;
    const next = page.pageInfo.endCursor;
    if (!next || seen.has(next)) throw new Error('Phân trang danh sách thùng không hợp lệ.');
    seen.add(next);
    after = next;
  }
}

export async function fetchOrderCartons(orderId: string): Promise<OrderCarton[]> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    throw new Error('Mã đơn hàng không hợp lệ.');
  }
  const lines = await pages<OrderCartonLine>('warehouseDocumentLines', 'id documentId sku productName',
    `{ salesOrderId: { eq: ${JSON.stringify(orderId)} } }`);
  if (!lines.length) return [];
  const documents = await pages<IssueDocument>('warehouseDocuments', 'id code warehouseId',
    `{ id: { in: ${JSON.stringify([...new Set(lines.map(line => line.documentId))])} }, kind: { eq: "Issue" }, reason: { eq: "Order" }, status: { neq: "Cancelled" } }`);
  const documentById = new Map(documents.map(document => [document.id, document]));
  const lineById = new Map(lines.filter(line => documentById.has(line.documentId)).map(line => [line.id, line]));
  if (!lineById.size) return [];
  const cartons = await pages<DocumentCarton>('warehouseDocumentCartons', 'id documentId lineId cartonId scannedAt',
    `{ lineId: { in: ${JSON.stringify([...lineById.keys()])} } }`);
  return cartons.map(carton => {
    const line = lineById.get(carton.lineId);
    const document = documentById.get(carton.documentId);
    if (!line || !document || line.documentId !== document.id) throw new Error('Dữ liệu thùng không khớp phiếu xuất kho.');
    return { ...carton, sku: line.sku, productName: line.productName, warehouseId: document.warehouseId, documentCode: document.code };
  }).sort((a, b) => a.documentCode.localeCompare(b.documentCode, 'vi', { numeric: true }) || a.cartonId.localeCompare(b.cartonId, 'vi', { numeric: true }));
}
