import { get, getAll } from '@/shared/api/http';
import type { Batch, BatchDetail, BatchMovement, ExpiryStatus } from './types';

interface InventoryRow {
  batchId: string; batchCode: string; warehouseCode: string; warehouseName: string;
  productId: string; sku: string; productName: string; expirationDate: string; expiryStatus: string;
  onHandQuantity: number; reservedQuantity: number; lockedQuantity: number; availableQuantity: number;
}
interface ProductRow { id: string; shelfLifeHours?: number }
interface HistoryRow {
  occurredAt: string; transactionType: string; referenceCode: string; onHandDelta: number; createdByUserId: string;
}

const expiryStatus = (value: string): ExpiryStatus => value === 'Valid' ? 'Normal' : value as ExpiryStatus;
const daysUntil = (isoDate: string) => Math.ceil((new Date(`${isoDate}T23:59:59`).getTime() - Date.now()) / 86_400_000);
const mapRow = (row: InventoryRow, product?: ProductRow): Batch => {
  const remainingDays = Math.max(0, daysUntil(row.expirationDate));
  const shelfLifeDays = Math.max(1, Math.round((product?.shelfLifeHours ?? remainingDays * 24) / 24));
  return {
    id: row.batchId,
    code: row.batchCode,
    warehouseCode: row.warehouseCode,
    warehouseName: row.warehouseName,
    sku: row.sku,
    productName: row.productName,
    expiry: row.expirationDate,
    onHand: row.onHandQuantity,
    held: row.reservedQuantity + row.lockedQuantity,
    available: row.availableQuantity,
    shelfLifeDays,
    remainingDays,
    remainingPct: Math.max(0, Math.min(100, Math.round(remainingDays / shelfLifeDays * 100))),
    expiryStatus: expiryStatus(row.expiryStatus),
    discountPct: null,
    discountUntil: null,
    discountCode: null,
  };
};

async function listRows() {
  const [inventory, products] = await Promise.all([
    getAll<InventoryRow>('/inventory', { includeExpired: true }),
    getAll<ProductRow>('/products'),
  ]);
  return inventory.map((row) => mapRow(row, products.find((p) => p.id === row.productId)));
}

export const batchApi = {
  list: listRows,
  get: async (code: string): Promise<BatchDetail> => {
    const batch = (await listRows()).find((row) => row.code === code);
    if (!batch?.id) throw new Error(`Không tìm thấy batch ${code}.`);
    const history = await get<HistoryRow[]>('/inventory/history', { batchId: batch.id });
    const movements: BatchMovement[] = history.map((row) => ({
      at: row.occurredAt,
      type: row.transactionType,
      document: row.referenceCode,
      qty: row.onHandDelta,
      by: row.createdByUserId,
    }));
    return { ...batch, history: movements };
  },
};
