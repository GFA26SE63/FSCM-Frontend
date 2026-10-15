import { D, DT, ddMMyyyy } from './dates';
import type { Db, DbBatch } from './types';

type Stock = Pick<Db, 'batches' | 'receipts' | 'disposals' | 'transfers' | 'batchDiscounts'>;

const B = (wh: string, sku: string, exp: string, available: number, held = 0): DbBatch => ({
  code: `${wh}-${sku}-${exp}`, warehouseCode: wh, sku, expiry: ddMMyyyy(exp), available, held, disposed: false, manufacturerLot: '',
});

export function stockData(): Stock {
  return {
    batches: [
      B('WH-TA', 'SKU001', '25092026', 10), B('WH-GV', 'SKU001', '06102026', 50), B('WH-CC', 'SKU001', '12102026', 90), B('WH-TA', 'SKU001', '18102026', 40),
      B('WH-TD', 'SKU001', '18102026', 80), B('WH-TCH', 'SKU001', '21102026', 35), B('WH-TCH', 'SKU001', '09112026', 0, 60),
      B('WH-TA', 'SKU002', '20102026', 100), B('WH-GV', 'SKU002', '12102026', 80), B('WH-TCH', 'SKU002', '10102026', 4),
      B('WH-GV', 'SKU003', '14102026', 20), B('WH-TA', 'SKU003', '24102026', 30), B('WH-TCH', 'SKU003', '30102026', 60),
      B('WH-GV', 'SKU004', '03102026', 24), B('WH-TCH', 'SKU004', '06102026', 34), B('WH-TA', 'SKU004', '07102026', 30), B('WH-CC', 'SKU004', '05102026', 40),
      B('WH-GV', 'SKU005', '26092026', 12), B('WH-TA', 'SKU005', '30092026', 25), B('WH-TCH', 'SKU005', '02102026', 40, 30), B('WH-GV', 'SKU005', '03102026', 30),
      B('WH-TD', 'SKU006', '21092026', 8), B('WH-TD', 'SKU006', '05102026', 40), B('WH-TCH', 'SKU006', '10102026', 50),
      B('WH-TA', 'SKU007', '20112026', 40), B('WH-CC', 'SKU007', '20112026', 20),
    ],
    receipts: [
      { code: 'PN-260927-01', warehouseCode: 'WH-TA', receivedAt: DT('27/09 07:20'), receivedBy: 'Đỗ Văn Tâm', note: '', lines: [{ sku: 'SKU002', batchCode: 'WH-TA-SKU002-20102026', expiry: D('20/10'), qty: 100, labels: 2, lot: 'L2609B' }] },
      { code: 'PN-260926-02', warehouseCode: 'WH-TCH', receivedAt: DT('26/09 16:05'), receivedBy: 'Phạm Minh Khoa', note: '', lines: [
        { sku: 'SKU005', batchCode: 'WH-TCH-SKU005-02102026', expiry: D('02/10'), qty: 70, labels: 2, lot: '' },
        { sku: 'SKU001', batchCode: 'WH-TCH-SKU001-09112026', expiry: D('09/11'), qty: 60, labels: 1, lot: 'L2609A' }] },
      { code: 'PN-260925-01', warehouseCode: 'WH-GV', receivedAt: DT('25/09 08:40'), receivedBy: 'Bùi Quang Minh', note: '', lines: [{ sku: 'SKU005', batchCode: 'WH-GV-SKU005-03102026', expiry: D('03/10'), qty: 30, labels: 1, lot: '' }] },
    ],
    disposals: [
      { code: 'PH-260922-01', warehouseCode: 'WH-TA', createdAt: DT('22/09 17:30'), createdBy: 'Đỗ Văn Tâm', reason: 'Hết hạn sử dụng', method: 'Tiêu hủy tại kho', lines: [{ sku: 'SKU005', batchCode: 'WH-TA-SKU005-20092026', expiry: D('20/09'), qty: 6 }] },
      { code: 'PH-260915-01', warehouseCode: 'WH-GV', createdAt: DT('15/09 16:10'), createdBy: 'Bùi Quang Minh', reason: 'Hết hạn sử dụng', method: 'Trả nhà cung cấp', lines: [
        { sku: 'SKU004', batchCode: 'WH-GV-SKU004-14092026', expiry: D('14/09'), qty: 9 }, { sku: 'SKU006', batchCode: 'WH-GV-SKU006-13092026', expiry: D('13/09'), qty: 5 }] },
    ],
    transfers: [
      { code: 'DC-260927-01', kind: 'Replenishment', fromWarehouse: 'WH-CC', toWarehouse: 'WH-TCH', sku: 'SKU001', sourceBatch: 'WH-CC-SKU001-12102026', expiry: D('12/10'), qty: 30, createdAt: DT('27/09 07:40'), createdBy: 'Trịnh Văn Hậu', status: 'InTransit', labelCode: 'TEM-000201', receivedNote: '', score: null, note: '' },
      { code: 'DC-260925-01', kind: 'Replenishment', fromWarehouse: 'WH-CC', toWarehouse: 'WH-TA', sku: 'SKU007', sourceBatch: 'WH-CC-SKU007-20112026', expiry: D('20/11'), qty: 40, createdAt: DT('25/09 08:10'), createdBy: 'Trịnh Văn Hậu', status: 'Received', labelCode: 'TEM-000178', receivedNote: '25/09/2026 10:05 · Đỗ Văn Tâm quét tem nhận', score: null, note: '' },
    ],
    batchDiscounts: [
      { code: 'KMB-260926-01', batchCode: 'WH-GV-SKU001-06102026', discountPct: 15, validFrom: D('26/09'), validTo: D('06/10'), createdBy: 'Phạm Minh Khoa', status: 'Active' },
      { code: 'KMB-260926-02', batchCode: 'WH-TD-SKU006-05102026', discountPct: 10, validFrom: D('26/09'), validTo: D('05/10'), createdBy: 'Phạm Minh Khoa', status: 'Active' },
    ],
  };
}
