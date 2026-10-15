/**
 * IdFormat – mirrors FSCM.SharedKernel.Ids.IdFormat (SPEC §3, decided 06/10/2026).
 * The server is the source of truth for sequences; the portal uses these to preview codes and validate input.
 */
export type DocumentType = 'GoodsReceipt' | 'Disposal' | 'Transfer' | 'Complaint' | 'BatchDiscount';

const pad = (n: number, w: number) => String(n).padStart(w, '0');
const yyMMdd = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
const ddMMyyyy = (iso: string) => iso.slice(8, 10) + iso.slice(5, 7) + iso.slice(0, 4);

const prefix: Record<DocumentType, string> = { GoodsReceipt: 'PN', Disposal: 'PH', Transfer: 'DC', Complaint: 'KN', BatchDiscount: 'KMB' };

export const IdFormat = {
  retailerRequest: (n: number) => `KB-${pad(n, 4)}`,
  category: (n: number) => `CAT-${pad(n, 2)}`,
  sku: (n: number) => `SKU${pad(n, 3)}`,
  label: (n: number) => `TEM-${pad(n, 6)}`,
  order: (n: number) => `DH-${pad(n, 6)}`,
  promotion: (n: number) => `KM-${pad(n, 3)}`,
  loyaltyProgram: (n: number) => `LP-${pad(n, 3)}`,
  gift: (n: number) => `QUA-${pad(n, 3)}`,
  driver: (n: number) => `NG-${pad(n, 3)}`,
  offlineOrder: (device: string, n: number) => `OFF-${device}-${pad(n, 4)}`,
  /** Picking list = order code + A/B/C… (one per warehouse). */
  picking: (orderCode: string, warehouseIndex: number) => orderCode + String.fromCharCode(65 + warehouseIndex),
  /** Batch = {warehouse}-{sku}-{expiry ddMMyyyy}. */
  batch: (warehouseCode: string, sku: string, expiryIso: string) => `${warehouseCode}-${sku}-${ddMMyyyy(expiryIso)}`,
  document: (type: DocumentType, dateIso: string, n: number) => `${prefix[type]}-${yyMMdd(dateIso)}-${pad(n, 2)}`,
  giftRequest: (dateIso: string, n: number) => `DQ-${yyMMdd(dateIso)}-${pad(n, 2)}`,

  isRetailerCode: (s: string) => /^\d{8}$/.test(s),
  isWarehouseCode: (s: string) => /^WH-[A-Z]{2,3}$/.test(s),
  isVehiclePlate: (s: string) => /^\d{2}[A-Z]{1,2}-?\d{3}\.?\d{2}$/.test(s.replace(/\s/g, '')),
  isAreaGroup: (s: string) => /^[A-Z0-9]{2,4}-[A-Z]$/.test(s),
  isPhone: (s: string) => /^0\d{9}$/.test(s.replace(/\s/g, '')),
  isSku: (s: string) => /^SKU\d{3}$/.test(s),
};
