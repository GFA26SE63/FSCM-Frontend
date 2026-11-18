import type { DashboardCard } from './types';

// Fixed presentation text emitted by the verified dashboard contract. Do not
// replace words inside arbitrary names, codes or user-entered business reasons.
const serverCopy: Record<string, string> = {
  'Đang chờ Retailer xác nhận PO': 'Đang chờ nhà bán lẻ xác nhận báo giá',
  'Shipment chờ xuất': 'Phiếu giao hàng chờ xuất',
  'Shipment ngoại lệ': 'Phiếu giao hàng cần xử lý phát sinh',
  'Tại các kho trong bộ lọc · kiểm tra readiness trước xuất': 'Tại các kho trong bộ lọc · kiểm tra điều kiện trước khi xuất kho',
  'Tỷ lệ báo giá thành PO': 'Tỷ lệ báo giá thành đơn thực hiện',
  'Đang giao quá ETA': 'Đang giao quá giờ nhận dự kiến',
  'Đã rời kho, retailer chưa nhận, đã qua giờ dự kiến': 'Đã rời kho, nhà bán lẻ chưa nhận, đã qua giờ dự kiến',
  'Sales đã gửi, chờ Admin xét duyệt': 'Nhân viên bán hàng đã gửi, chờ quản trị viên xét duyệt',
  'Khu vực / nhóm Sales được quản lý': 'Khu vực / nhóm bán hàng được quản lý',
  'Doanh thu ghi nhận theo đơn Completed và thời điểm hoàn tất; giá trị đã trừ khuyến mãi và điều chỉnh.': 'Doanh thu ghi nhận theo đơn hoàn tất và thời điểm hoàn tất; giá trị đã trừ khuyến mãi và điều chỉnh.',
  'Bộ lọc kho áp dụng cho tồn kho, nhập, soạn và shipment. Báo cáo tiền/đơn theo khu vực và nhóm Sales.': 'Bộ lọc kho áp dụng cho tồn kho, nhập, soạn và giao hàng. Báo cáo tiền/đơn theo khu vực và nhóm bán hàng.',
  'Hàng chờ đổi quà theo khu vực/nhóm Sales, không phụ thuộc kho hoặc kỳ ngày.': 'Hàng chờ đổi quà theo khu vực/nhóm bán hàng, không phụ thuộc kho hoặc kỳ ngày.',
  'Chỉ trạng thái Refunded mới tính là đã hoàn': 'Chỉ trạng thái Đã hoàn mới tính là đã hoàn tiền',
  'Kiểm tra SKU, batch và số lượng nhập': 'Kiểm tra SKU, lô hàng và số lượng nhập',
};

export function dashboardText(text: string): string {
  return serverCopy[text] ?? text;
}

export function dashboardCardCopy(card: DashboardCard): DashboardCard {
  let note = dashboardText(card.note);
  if (card.key === 'fillRate') {
    note = note.replace(/^([\d.,]+\/[\d.,]+) thùng retailer xác nhận nhận$/, '$1 thùng nhà bán lẻ xác nhận nhận');
  }
  return { ...card, label: dashboardText(card.label), note };
}
