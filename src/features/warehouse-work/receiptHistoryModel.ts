/**
 * "Lịch sử Phiếu Nhập Kho": factory receipts shown one row per dispatch note (PXN).
 * New receipts are already one PNK per note. Older receipts were opened one per pallet, so several PNKs of the same
 * note are shown together here. Display only: every PNK keeps its own code, stock ledger and QR history.
 */

/** GET /warehouse-documents/factory-receipt-groups */
export interface FactoryReceiptGroup {
  key: string;
  dispatchCode: string | null;
  dispatchedAt: string | null;
  documentIds: string[];
  pallets: { palletCode: string; documentId: string; accepted: number; damaged: number; missing: number }[];
}

export interface HistoryLine { sku: string; productName: string; batchCode: string | null; sourceLotCode: string | null; quantity: number; expirationDate: string }
export interface HistoryDoc { document: { id: string; code: string; status: string; warehouseId: string; createdAt: string; note?: string | null }; lines: HistoryLine[] }

export interface HistoryRow<T extends HistoryDoc> {
  key: string;
  /** All PNKs of the dispatch note (oldest first); one for receipts opened from a dispatch note. */
  docs: T[];
  group: FactoryReceiptGroup | null;
}

/**
 * One row per dispatch note. A row is shown when at least one of its PNKs passes the page filters; the row then
 * carries every PNK of the note so the popup shows the whole note.
 */
export function groupHistoryRows<T extends HistoryDoc>(visible: T[], all: T[], groups: FactoryReceiptGroup[] | undefined): HistoryRow<T>[] {
  const groupOf = new Map<string, FactoryReceiptGroup>();
  for (const g of Array.isArray(groups) ? groups : []) for (const id of Array.isArray(g?.documentIds) ? g.documentIds : []) groupOf.set(id, g);
  const byId = new Map(all.map(w => [w.document.id, w]));
  const rows: HistoryRow<T>[] = [];
  const seen = new Set<string>();
  for (const w of visible) {
    const group = groupOf.get(w.document.id) ?? null;
    const key = group?.key ?? w.document.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const docs = group ? group.documentIds.map(id => byId.get(id)).filter((x): x is T => !!x) : [w];
    rows.push({ key, docs: docs.length ? docs : [w], group });
  }
  return rows;
}

/** Posted only when every PNK of the note is posted. */
export const rowStatus = (row: HistoryRow<HistoryDoc>): string =>
  row.docs.every(w => w.document.status === 'Posted') ? 'Posted' : row.docs.find(w => w.document.status !== 'Posted')!.document.status;

export const rowCartons = (row: HistoryRow<HistoryDoc>): number =>
  row.docs.reduce((sum, w) => sum + w.lines.reduce((s, l) => s + l.quantity, 0), 0);

/** Lines of all PNKs of the note, summed per SKU / stock batch / expiry. */
export function combinedLines(row: HistoryRow<HistoryDoc>): HistoryLine[] {
  const result = new Map<string, HistoryLine>();
  for (const w of row.docs) for (const l of w.lines) {
    const key = `${l.sku}|${l.batchCode ?? l.sourceLotCode ?? ''}|${l.expirationDate}`;
    const prior = result.get(key);
    result.set(key, prior ? { ...prior, quantity: prior.quantity + l.quantity } : { ...l });
  }
  return [...result.values()].sort((a, b) => a.sku.localeCompare(b.sku) || a.expirationDate.localeCompare(b.expirationDate));
}

/** Label of the "Phiếu xuất nhà máy" column. */
export function dispatchLabel(row: HistoryRow<HistoryDoc>): string {
  const pallets = row.group?.pallets.length ?? 0;
  const code = row.group?.dispatchCode ?? (pallets > 1 ? 'Chuyến xuất cùng lúc' : null);
  if (!code) return '—';
  return `${code} · ${pallets} pallet${row.docs.length > 1 ? ` · ${row.docs.length} PNK` : ''}`;
}
