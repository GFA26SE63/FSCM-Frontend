import { D, DT } from './dates';
import type { Db, DbOrder, OrderStatus } from './types';

type OrdersData = Pick<Db, 'orders' | 'pickStatus'>;

const BASE_PROMOS = ['KM-001', 'KM-002', 'KM-004'];
const WITH_KM3 = [...BASE_PROMOS, 'KM-003'];

function mk(code: string, retailerCode: string, lines: { sku: string; qty: number }[], status: OrderStatus, createdAt: string, salesName: string, extra: Partial<DbOrder> = {}): DbOrder {
  return {
    code, retailerCode, lines, status, createdAt: DT(createdAt), salesName, channel: 'Online', syncedAt: null, syncMode: null, promoChanged: false, localDiscount: 0,
    paymentMethod: 'COD', prepaidChannel: null, termDays: null, paidNote: 'Chưa thanh toán', reason: '', reviewer: '', promoIds: BASE_PROMOS, heldBefore: {},
    delivery: null, credit: null, archived: false, timeline: [], ...extra,
  };
}
const tl = (...items: [string, string][]) => items.map(([at, label]) => ({ at: DT(at), label }));

export function orderData(): OrdersData {
  const orders: DbOrder[] = [
    mk('DH-001030', '10004127', [{ sku: 'SKU001', qty: 60 }, { sku: 'SKU003', qty: 30 }], 'Pending', '27/09 10:12', 'Nguyễn Văn An', {
      timeline: tl(['27/09 10:12', 'Sales Nguyễn Văn An tạo đơn (online)'], ['27/09 10:12', 'Hệ thống tính khuyến mãi, chạy phân bổ B1–B4, tạm giữ hàng'], ['27/09 10:12', 'Chờ duyệt']),
    }),
    mk('DH-001029', '10004135', [{ sku: 'SKU005', qty: 30 }], 'Pending', '27/09 10:20', 'Nguyễn Văn An', {
      channel: 'Offline', syncedAt: DT('27/09 10:31'), syncMode: 'Thủ công – Sales bấm đồng bộ (tự động thất bại lúc 10:29)', promoChanged: true, localDiscount: 720000,
      heldBefore: { 'WH-TCH-SKU005-02102026': 0 },
      timeline: tl(['27/09 10:20', 'Tạo đơn khi offline trên app (khuyến mãi tạm tính −720.000đ)'], ['27/09 10:31', 'Đồng bộ – hệ thống tính lại khuyến mãi: KM-003 đã tạm dừng → −0đ'], ['27/09 10:31', 'Phân bổ B1–B4, tạm giữ hàng – chờ duyệt']),
    }),
    mk('DH-001028', '10004127', [{ sku: 'SKU001', qty: 60 }], 'Rejected', '27/09 10:17', 'Nguyễn Văn An', {
      channel: 'Offline', syncedAt: DT('27/09 10:30'), syncMode: 'Thủ công – Sales bấm đồng bộ (tự động thất bại lúc 10:29)',
      reason: 'Không đủ hàng – đơn khác đã được xử lý trước (SKU001 cần 60, chỉ còn 15 thùng hợp lệ).',
      heldBefore: { 'WH-TA-SKU001-18102026': 40, 'WH-TD-SKU001-18102026': 80, 'WH-TCH-SKU001-21102026': 20 },
      timeline: tl(['27/09 10:17', 'Tạo đơn khi offline trên app'], ['27/09 10:30', 'Đồng bộ – đơn DH-000931 và DH-001030 tới trước đã giữ hàng SKU001'], ['27/09 10:30', 'Hệ thống tự động từ chối, báo Sales và retailer']),
    }),
    mk('DH-001025', '10004219', [{ sku: 'SKU002', qty: 40 }, { sku: 'SKU006', qty: 30 }], 'Pending', '27/09 09:05', 'Trần Thị Bình', {
      paymentMethod: 'Prepaid', prepaidChannel: 'Cash', paidNote: 'Đã thanh toán (Sales xác nhận)', promoIds: WITH_KM3,
      timeline: tl(['27/09 09:05', 'Sales Trần Thị Bình tạo đơn (online)'], ['27/09 09:05', 'Chờ duyệt']),
    }),
    mk('DH-001024', '10004182', [{ sku: 'SKU001', qty: 50 }, { sku: 'SKU003', qty: 20 }], 'Approved', '27/09 08:10', 'Nguyễn Văn An', {
      reviewer: 'Lý Thu Trang (Operator)', paymentMethod: 'Prepaid', prepaidChannel: 'Cash', paidNote: 'Đã thanh toán (Sales xác nhận)', promoIds: WITH_KM3,
      timeline: tl(['27/09 08:10', 'Tạo đơn (online)'], ['27/09 08:32', 'Operator duyệt – sinh picking list, batch chuyển Reserved']),
    }),
    mk('DH-001022', '10004135', [{ sku: 'SKU004', qty: 20 }], 'Shipped', '26/09 15:40', 'Trần Thị Bình', {
      reviewer: 'Phạm Minh Khoa (Admin)', paymentMethod: 'Credit', termDays: 30, promoIds: WITH_KM3,
      credit: { termDays: 30, deliveredAt: null, dueDate: null, paid: false, paidAt: null, collectedBy: null, method: null },
      timeline: tl(['26/09 15:40', 'Tạo đơn (online)'], ['26/09 16:10', 'Admin duyệt'], ['27/09 07:55', 'Warehouse Keeper xác nhận đã xuất']),
    }),
    mk('DH-001021', '10004127', [{ sku: 'SKU001', qty: 60 }, { sku: 'SKU003', qty: 30 }], 'Delivering', '26/09 14:20', 'Nguyễn Văn An', {
      reviewer: 'Phạm Minh Khoa (Admin)', promoIds: WITH_KM3, heldBefore: { 'WH-TCH-SKU001-21102026': 35, 'WH-TA-SKU003-24102026': 20 },
      delivery: { plate: '51C-482.17', vehicleType: 'Xe tải lạnh 1,5 tấn', driverCode: 'NG-001', driverName: 'Trương Văn Lực', driverPhone: '0907 118 552', departedAt: DT('27/09 09:15') },
      timeline: tl(['26/09 14:20', 'Tạo đơn (online)'], ['26/09 16:05', 'Admin duyệt'], ['27/09 08:40', 'Kho đã xuất'], ['27/09 09:15', 'Operator cập nhật Đang giao']),
    }),
    mk('DH-001019', '10004135', [{ sku: 'SKU003', qty: 30 }, { sku: 'SKU004', qty: 12 }], 'Delivered', '24/09 10:30', 'Nguyễn Văn An', {
      reviewer: 'Lý Thu Trang (Operator)', promoIds: WITH_KM3, heldBefore: { 'WH-TA-SKU003-24102026': 20 },
      paymentMethod: 'Prepaid', prepaidChannel: 'QR', paidNote: 'Đã thanh toán (Operator xác nhận)',
      delivery: { plate: '51D-209.33', vehicleType: 'Xe tải lạnh 1 tấn', driverCode: 'NG-002', driverName: 'Phan Thanh Sơn', driverPhone: '0938 402 117', departedAt: DT('24/09 14:30') },
      timeline: tl(['24/09 10:30', 'Tạo đơn'], ['24/09 16:40', 'Retailer quét QR xác nhận đã nhận']),
    }),
    mk('DH-000994', '10004127', [{ sku: 'SKU003', qty: 25 }], 'Delivered', '18/09 08:50', 'Nguyễn Văn An', {
      archived: true, reviewer: 'Lý Thu Trang (Operator)', paymentMethod: 'Credit', termDays: 14,
      credit: { termDays: 14, deliveredAt: DT('18/09 15:05'), dueDate: D('02/10'), paid: false, paidAt: null, collectedBy: null, method: null },
      delivery: { plate: '51C-482.17', vehicleType: 'Xe tải lạnh 1,5 tấn', driverCode: 'NG-001', driverName: 'Trương Văn Lực', driverPhone: '0907 118 552', departedAt: DT('18/09 13:40') },
      timeline: tl(['18/09 08:50', 'Sales Nguyễn Văn An tạo đơn (online)'], ['18/09 09:20', 'Operator duyệt'], ['18/09 15:05', 'Retailer quét QR xác nhận đã nhận – ghi nợ, hạn trả 02/10']),
    }),
    mk('DH-000987', '10004219', [{ sku: 'SKU002', qty: 20 }], 'Delivered', '15/09 09:40', 'Nguyễn Văn An', {
      archived: true, reviewer: 'Lý Thu Trang (Operator)', paymentMethod: 'Credit', termDays: 7,
      credit: { termDays: 7, deliveredAt: DT('15/09 16:30'), dueDate: D('22/09'), paid: false, paidAt: null, collectedBy: null, method: null },
      delivery: { plate: '51D-209.33', vehicleType: 'Xe tải lạnh 1 tấn', driverCode: 'NG-002', driverName: 'Phan Thanh Sơn', driverPhone: '0938 402 117', departedAt: DT('15/09 13:10') },
      timeline: tl(['15/09 09:40', 'Sales Nguyễn Văn An tạo đơn (online)'], ['15/09 10:05', 'Operator duyệt'], ['15/09 16:30', 'Retailer quét QR xác nhận đã nhận – ghi nợ, hạn trả 22/09'], ['23/09 08:00', 'Quá hạn thanh toán – đã báo Sales phụ trách truy thu']),
    }),
    mk('DH-001018', '10004127', [{ sku: 'SKU004', qty: 90 }], 'Rejected', '23/09 16:45', 'Nguyễn Văn An', {
      promoIds: WITH_KM3, reason: 'Không đủ hàng khả dụng hợp lệ cho SKU004.',
      timeline: tl(['23/09 16:45', 'Tạo đơn (online)'], ['23/09 16:45', 'Hệ thống tự động từ chối – không đủ hàng']),
    }),
  ];
  return { orders, pickStatus: { 'DH-001024A': 'NotPicked', 'DH-001024B': 'NotPicked' } };
}
