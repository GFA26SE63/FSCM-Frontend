import { graphql } from '@/shared/api/graphql';
import type { OrderCarton } from '@/features/orders/orderCartons';

interface Connection<T> { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
interface Line { id: string; productId: string; sku: string; productName: string; quantity: number }
interface Carton { id: string; documentId: string; lineId: string; cartonId: string; scannedAt: string | null }
export interface TransferDispatchProduct {
  productId: string; sku: string; productName: string; quantity: number; cartons: OrderCarton[];
}

async function pages<T>(field: string, selection: string, where: string): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let after: string | null = null;
  for (;;) {
    const data: { entities: Record<string, Connection<T>> } = await graphql(`
      query TransferDispatchGoods($after: String) { entities {
        ${field}(first: 100, after: $after, where: ${where}, order: [{ id: ASC }]) {
          nodes { ${selection} } pageInfo { hasNextPage endCursor }
        }
      } }`, { after });
    const page = data.entities[field];
    if (!Array.isArray(page?.nodes) || !page.pageInfo) throw new Error('Không tải được hàng hóa luân chuyển.');
    rows.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) return rows;
    const next = page.pageInfo.endCursor;
    if (!next || seen.has(next)) throw new Error('Phân trang hàng hóa luân chuyển không hợp lệ.');
    seen.add(next); after = next;
  }
}

/** Use the exact source issue snapshot, never inventory currently held by the warehouse. */
export async function fetchTransferDispatchGoods(issueDocumentId: string): Promise<TransferDispatchProduct[]> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(issueDocumentId)) throw new Error('Mã phiếu xuất kho không hợp lệ.');
  const documents = await pages<{ id: string; code: string; warehouseId: string }>('warehouseDocuments', 'id code warehouseId',
    `{ id: { eq: ${JSON.stringify(issueDocumentId)} }, kind: { eq: "Issue" }, reason: { eq: "Transfer" } }`);
  const document = documents.find(item => item.id === issueDocumentId);
  if (!document) throw new Error('Không tìm thấy hoặc không có quyền xem phiếu xuất luân chuyển.');
  const where = `{ documentId: { eq: ${JSON.stringify(issueDocumentId)} } }`;
  const [lines, cartons] = await Promise.all([
    pages<Line>('warehouseDocumentLines', 'id productId sku productName quantity', where),
    pages<Carton>('warehouseDocumentCartons', 'id documentId lineId cartonId scannedAt', where),
  ]);
  const lineById = new Map(lines.map(line => [line.id, line]));
  const groups = new Map<string, TransferDispatchProduct>();
  for (const line of lines) {
    const current = groups.get(line.productId);
    if (current) current.quantity += line.quantity;
    else groups.set(line.productId, { productId: line.productId, sku: line.sku, productName: line.productName, quantity: line.quantity, cartons: [] });
  }
  for (const carton of cartons) {
    const line = lineById.get(carton.lineId);
    if (!line || carton.documentId !== issueDocumentId) throw new Error('Dữ liệu thùng không khớp phiếu xuất luân chuyển.');
    groups.get(line.productId)!.cartons.push({ ...carton, sku: line.sku, productName: line.productName, warehouseId: document.warehouseId, documentCode: document.code });
  }
  for (const product of groups.values()) product.cartons.sort((a, b) => a.cartonId.localeCompare(b.cartonId, 'vi', { numeric: true }));
  return [...groups.values()].sort((a, b) => a.sku.localeCompare(b.sku, 'vi', { numeric: true }));
}
