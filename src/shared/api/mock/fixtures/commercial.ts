import { D, DT } from './dates';
import type { Db, DbLedgerEntry } from './types';

type Commercial = Pick<Db, 'promotions' | 'loyaltyProgram' | 'loyalty' | 'gifts' | 'redemptions' | 'complaints' | 'refunds' | 'kpi' | 'topProducts' | 'notifications' | 'rotationStatus' | 'rotationQty'>;

const E = (date: string, description: string, points: number): DbLedgerEntry => ({ date: D(date), description, kind: 'Earned', points });
const Pn = (date: string, description: string): DbLedgerEntry => ({ date: D(date), description, kind: 'Pending', points: null });
const X = (date: string, description: string, points: number): DbLedgerEntry => ({ date: D(date), description, kind: 'Redeemed', points: -points });

export function commercialData(): Commercial {
  return {
    promotions: [
      // KM-001 used to carry 5% for SKU001 and 4% for SKU002 in one programme. The server has one
      // percentage per promotion, so that is two programmes.
      { code: 'KM-001', name: 'Ưu đãi sữa chua tháng 9', validFrom: D('01/09'), validTo: D('31/12'), retailerCodes: null, active: true,
        minQty: 50, discountPct: 5, skus: ['SKU001'], categoryCodes: [] },
      { code: 'KM-005', name: 'Ưu đãi sữa chua uống tháng 9', validFrom: D('01/09'), validTo: D('30/09'), retailerCodes: null, active: true,
        minQty: 30, discountPct: 4, skus: ['SKU002'], categoryCodes: [] },
      // Was a group promotion on the combined quantity; the server checks each line on its own.
      { code: 'KM-002', name: 'Combo sữa tươi', validFrom: D('15/09'), validTo: D('31/12'), retailerCodes: ['10004127', '10004135', '10004182'], active: true,
        minQty: 20, discountPct: 3, skus: ['SKU003', 'SKU004'], categoryCodes: [] },
      { code: 'KM-003', name: 'Xả hàng bánh tươi', validFrom: D('20/09'), validTo: D('31/12'), retailerCodes: null, active: false,
        minQty: 20, discountPct: 8, skus: ['SKU005', 'SKU006'], categoryCodes: [] },
      { code: 'KM-004', name: 'Khách hàng thân thiết', validFrom: D('01/09'), validTo: D('31/12'), retailerCodes: ['10004135'], active: true,
        minQty: 30, discountPct: 5, skus: ['SKU003'], categoryCodes: [] },
    ],
    loyaltyProgram: { code: 'LP-001', name: 'Tích điểm đổi quà 2026', scope: 'Tất cả retailer đang hoạt động', validFrom: D('01/09'), validTo: D('31/12'), pointsExpireOn: D('31/03/2027'), status: 'Running' },
    loyalty: [
      { retailerCode: '10004127', balance: 412, ledger: [
        Pn('27/09', 'DH-001021 · đang giao (cộng khi quét QR nhận hàng)'), E('25/09', 'DH-001015 · đã giao, đã thanh toán', 142), Pn('18/09', 'DH-000994 · công nợ, cộng khi đã thanh toán'),
        E('14/09', 'DH-001012 · đã giao, đã thanh toán', 125), X('10/09', 'Đổi quà QUA-005 Áo thun đồng phục · DQ-260910-01', 50), E('05/09', 'DH-001006 · đã giao, đã thanh toán', 135)] },
      { retailerCode: '10004135', balance: 742, ledger: [
        E('24/09', 'DH-001019 · đã giao, đã thanh toán', 133), E('20/09', 'DH-000997 · đã giao, đã thanh toán', 193), E('11/09', 'DH-000970 · đã giao, đã thanh toán', 163), E('02/09', 'DH-000948 · đã giao, đã thanh toán', 209)] },
      { retailerCode: '10004182', balance: 221, ledger: [
        X('20/09', 'Đổi quà QUA-003 Bộ ly thủy tinh · DQ-260920-01', 120), E('22/09', 'DH-001009 · đã giao, đã thanh toán', 84), E('21/09', 'DH-001003 · đã giao, đã thanh toán', 118), E('08/09', 'DH-000961 · đã giao, đã thanh toán', 124)] },
      { retailerCode: '10004219', balance: 272, ledger: [
        E('23/09', 'DH-001013 · đã giao, đã thanh toán', 104), E('18/09', 'DH-000990 · đã giao, đã thanh toán', 72), Pn('15/09', 'DH-000987 · công nợ quá hạn, cộng khi đã thanh toán'), E('13/09', 'DH-000976 · đã giao, đã thanh toán', 96)] },
      { retailerCode: '10004256', balance: 0, ledger: [] },
      { retailerCode: '10004288', balance: 0, ledger: [] },
    ],
    gifts: [
      { code: 'QUA-001', name: 'Ô dù che nắng cửa hàng', points: 200, stock: 15, redeemed: 3, status: 'Active' },
      { code: 'QUA-002', name: 'Thùng đá giữ lạnh 30L', points: 350, stock: 8, redeemed: 2, status: 'Active' },
      { code: 'QUA-003', name: 'Bộ ly thủy tinh 6 cái', points: 120, stock: 29, redeemed: 6, status: 'Active' },
      { code: 'QUA-004', name: 'Tủ mát mini 90L', points: 1500, stock: 2, redeemed: 0, status: 'Active' },
      { code: 'QUA-005', name: 'Áo thun đồng phục', points: 50, stock: 40, redeemed: 11, status: 'Active' },
    ],
    redemptions: [
      { code: 'DQ-260926-01', retailerCode: '10004135', giftCode: 'QUA-002', points: 350, requestedAt: DT('26/09 15:10'), status: 'Requested', handledNote: '' },
      { code: 'DQ-260920-01', retailerCode: '10004182', giftCode: 'QUA-003', points: 120, requestedAt: DT('20/09 09:30'), status: 'Approved', handledNote: '20/09 14:00 · Phạm Minh Khoa' },
      { code: 'DQ-260910-01', retailerCode: '10004127', giftCode: 'QUA-005', points: 50, requestedAt: DT('10/09 10:00'), status: 'Done', handledNote: '12/09 09:15 · giao kèm DH-001012' },
    ],
    complaints: [
      { code: 'KN-260924-01', orderCode: 'DH-001019', retailerCode: '10004135', content: 'Nhận 28/30 thùng SKU003 – thiếu 2 thùng so với phiếu xuất, gửi kèm 2 ảnh', createdAt: DT('24/09 16:45'), status: 'Open', result: '' },
      { code: 'KN-260915-01', orderCode: 'DH-000987', retailerCode: '10004219', content: 'Một thùng SKU002 móp hộp khi nhận', createdAt: DT('15/09 17:10'), status: 'Resolved', result: 'Operator ghi nhận, nhắc đơn vị giao hàng kiểm tra đóng gói' },
    ],
    refunds: [
      { id: 'rf-001', orderCode: 'DH-001019', salesOrderId: 'DH-001019', amount: 286000, recipient: 'Siêu thị mini Hòa Bình', reason: 'Điều chỉnh phần hàng thiếu đã được duyệt', status: 'PendingRefund', transferredAt: null, transactionReference: null, evidenceReference: null, version: 1, createdAt: DT('25/09 09:20'), updatedAt: DT('25/09 09:20') },
    ],
    kpi: [
      { name: 'Trần Thị Bình', group: 'Q12-A', before: 272400000, after: 245700000, orders: 24, stores: 9, newStores: 1, target: 260000000 },
      { name: 'Lê Minh Hoàng', group: 'Q12-B', before: 238100000, after: 235200000, orders: 21, stores: 8, newStores: 2, target: 230000000 },
      { name: 'Nguyễn Văn An', group: 'Q12-A', before: 261840000, after: 257201800, orders: 19, stores: 4, newStores: 2, target: 240000000 },
      { name: 'Phạm Thu Hà', group: 'Q12-B', before: 176200000, after: 171400000, orders: 17, stores: 7, newStores: 0, target: 200000000 },
      { name: 'Võ Quốc Huy', group: 'Q12-A', before: 151900000, after: 150300000, orders: 15, stores: 6, newStores: 1, target: 180000000 },
      { name: 'Đặng Mỹ Linh', group: 'Q12-B', before: 143500000, after: 129800000, orders: 16, stores: 6, newStores: 0, target: 160000000 },
      { name: 'Huỳnh Gia Bảo', group: 'Q12-A', before: 128400000, after: 126900000, orders: 13, stores: 5, newStores: 1, target: 150000000 },
      { name: 'Ngô Thanh Tâm', group: 'Q12-B', before: 97600000, after: 94100000, orders: 10, stores: 4, newStores: 0, target: 120000000 },
    ],
    topProducts: [['SKU001', 1240, 297800000], ['SKU003', 980, 301900000], ['SKU002', 760, 155300000], ['SKU005', 640, 179200000], ['SKU004', 410, 143100000], ['SKU006', 380, 99600000], ['SKU007', 120, 63500000]],
    notifications: [
      { id: 'N-001', title: 'Đơn chờ duyệt', body: '3 đơn hàng đang chờ duyệt (DH-001030, DH-001029, DH-001025).', createdAt: DT('27/09 10:31'), read: false, link: '/orders' },
      { id: 'N-002', title: 'Công nợ quá hạn', body: 'Đơn DH-000987 đã quá hạn thanh toán từ 22/09.', createdAt: DT('27/09 08:00'), read: false, link: '/debts' },
      { id: 'N-003', title: 'Retailer mới chờ duyệt', body: 'KB-0012 Tạp hóa Hải Yến do Sales Nguyễn Văn An khai báo.', createdAt: DT('26/09 16:20'), read: false, link: '/retailers' },
      { id: 'N-004', title: 'Khiếu nại mới', body: 'KN-260924-01 từ Siêu thị mini Hòa Bình (đơn DH-001019).', createdAt: DT('24/09 16:45'), read: true, link: '/complaints' },
    ],
    rotationStatus: {},
    rotationQty: {},
  };
}
