/** Keep saved list URLs usable when only their display vocabulary changes. */
const legacyNames: Record<string, string> = {
  'Nhóm bán hàng': 'nhomsales',
};
const legacyValues: Record<string, string[]> = {
  Admin: ['Quản trị viên'], Operator: ['Nhân viên vận hành'],
  WarehouseKeeper: ['Thủ kho'], 'Warehouse Keeper': ['Thủ kho'],
  SalesManager: ['Quản lý bán hàng'], 'Sales Manager': ['Quản lý bán hàng'],
  Sales: ['Nhân viên bán hàng'], Retailer: ['Điểm bán'],
  Inactive: ['Ngừng bán', 'Ngừng hoạt động'], 'Đã publish': ['Đang bán', 'Đã công bố'],
  'Chưa pick': ['Chưa soạn hàng'], 'Đang pick': ['Đang soạn hàng'],
  Online: ['Trực tuyến'], Offline: ['Ngoại tuyến'],
  'Đã tạo PO': ['Đã phát hành đơn thực hiện'],
  'Chờ Retailer xác nhận báo giá': ['Chờ điểm bán xác nhận báo giá'],
};

export function tableFilterParam(label: string): string {
  return legacyNames[label] ?? (label.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'filter');
}

export function tableFilterValue(raw: string, allowed: string[]): string {
  if (allowed.includes(raw)) return raw; // API enum values and real names take precedence.
  return legacyValues[raw]?.find(value => allowed.includes(value)) ?? raw;
}
