export interface RoleItem {
  id: string;
  code: string;
  baseRole?: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleInput {
  code: string;
  name: string;
  description?: string;
  selectedScreenCodes: string[];
  baseRole?: string;
}

export interface UpdateRoleInput {
  name: string;
  description?: string;
  selectedScreenCodes: string[];
}

export interface ScreenFeature {
  key: string;
  name: string;
  description: string;
  groupKey: string;
  groupLabel: string;
}

export interface ScreenGroup {
  key: string;
  label: string;
  platform?: 'web' | 'mobile';
  screens: {
    key: string;
    name: string;
    description: string;
  }[];
}

// ----------------------------------------------------
// 1. CỔNG WEB (WEB PORTAL - 32 màn hình)
// ----------------------------------------------------
export const WEB_SCREEN_GROUPS: ScreenGroup[] = [
  {
    key: 'overview',
    label: 'Tổng quan & Báo cáo',
    platform: 'web',
    screens: [
      { key: 'dashboard', name: 'Tổng quan & báo cáo', description: 'Xem tổng quan hiệu suất kinh doanh và các chỉ số hoạt động' },
      { key: 'reports', name: 'Báo cáo đổi quà & CTKM', description: 'Báo cáo chi tiết đổi quà, tích điểm và chương trình khuyến mãi' },
      { key: 'warehouse-report', name: 'Báo cáo kho vận', description: 'Báo cáo nhập xuất tồn và hiệu suất vận hành kho' },
      { key: 'kpi', name: 'KPI & Xếp hạng kinh doanh', description: 'Theo dõi KPI và xếp hạng thành tích kinh doanh' },
    ],
  },
  {
    key: 'sales',
    label: 'Bán hàng & Tài chính',
    platform: 'web',
    screens: [
      { key: 'orders', name: 'Đơn hàng', description: 'Quản lý, duyệt và theo dõi trạng thái đơn đặt hàng' },
      { key: 'allocation', name: 'Phân bổ theo thời gian thực', description: 'Theo dõi và quản lý phân bổ nguồn hàng tự động' },
      { key: 'debts', name: 'Công nợ', description: 'Theo dõi nợ phải thu, thanh toán PayOS và đối soát công nợ' },
      { key: 'refunds', name: 'Hoàn tiền', description: 'Lập và duyệt các yêu cầu hoàn tiền hàng lỗi / hoàn tiền cọc' },
      { key: 'complaints', name: 'Khiếu nại & Yêu cầu', description: 'Tiếp nhận, xử lý khiếu nại và yêu cầu thu hồi hàng' },
    ],
  },
  {
    key: 'warehouse',
    label: 'Kho vận & Hàng hóa',
    platform: 'web',
    screens: [
      { key: 'warehouse-inbound', name: 'Nhập kho (PNK)', description: 'Lập và kiểm duyệt chứng từ nhập hàng vào kho' },
      { key: 'warehouse-factory-requests', name: 'Yêu cầu nhận hàng từ nhà máy', description: 'Tiếp nhận phiếu xuất xưởng của nhà máy và mở phiếu kiểm đếm khi hàng đến kho' },
      { key: 'warehouse-outbound', name: 'Xuất kho (PXK)', description: 'Lập và kiểm duyệt chứng từ xuất hàng ra khỏi kho' },
      { key: 'warehouse-transfers', name: 'Luân chuyển kho', description: 'Quản lý phiếu chuyển kho nội bộ giữa các chi nhánh' },
      { key: 'batches', name: 'Quản lý lô hàng', description: 'Theo dõi thông tin chi tiết lô, HSD và in mã QR thùng hàng' },
      { key: 'warehouse-trace', name: 'Tra cứu kiện / thùng', description: 'Quét mã QR tra cứu lịch sử luân chuyển kiện thùng hàng' },
      { key: 'readiness', name: 'Điều phối vận tải', description: 'Điều phối giao hàng và luân chuyển, phân bổ phương tiện và tài xế' },
      { key: 'batchpromo', name: 'Giảm giá theo HSD', description: 'Thiết lập chính sách giảm giá cho các lô hàng cận date' },
      { key: 'disposal', name: 'Hủy hàng hết hạn', description: 'Biên bản tiêu hủy và xử lý hàng hóa quá hạn sử dụng' },
      { key: 'fleet', name: 'Xe & Tài xế', description: 'Quản lý danh mục phương tiện vận tải và tài xế giao hàng' },
    ],
  },
  {
    key: 'customer',
    label: 'Khách hàng & Khuyến mãi',
    platform: 'web',
    screens: [
      { key: 'retailers', name: 'Nhà bán lẻ', description: 'Hồ sơ đại lý, duyệt hồ sơ bán lẻ và hạn mức công nợ' },
      { key: 'promos', name: 'Chương trình khuyến mãi', description: 'Cấu hình chiết khấu, khuyến mãi bậc thang và combo' },
      { key: 'loyalty', name: 'Tích điểm thành viên', description: 'Chính sách tích lũy điểm thưởng và tỷ lệ quy đổi' },
      { key: 'redeem', name: 'Đổi quà tích điểm', description: 'Duyệt các yêu cầu đổi quà của đại lý và điểm bán' },
      { key: 'gifts', name: 'Danh mục quà tặng', description: 'Quản lý quà tặng, điểm quy đổi và số lượng tồn kho' },
    ],
  },
  {
    key: 'catalog',
    label: 'Danh mục dữ liệu gốc',
    platform: 'web',
    screens: [
      { key: 'regions', name: 'Khu vực & Nhóm bán hàng', description: 'Phân định địa lý và quản lý đội ngũ kinh doanh phụ trách' },
      { key: 'cats', name: 'Danh mục sản phẩm', description: 'Cây phân loại nhóm hàng hóa tiêu dùng nhanh FMCG' },
      { key: 'catmlor', name: 'Yêu cầu HSD tối thiểu (MLOR)', description: 'Quy định tỷ lệ hạn dùng tối thiểu khi xuất giao đại lý' },
      { key: 'skus', name: 'Sản phẩm (SKU)', description: 'Thông tin mã hàng, đơn giá niêm yết và quy cách đóng gói' },
      { key: 'whs', name: 'Danh mục kho hàng', description: 'Quản lý danh sách các kho tổng và kho trung chuyển' },
    ],
  },
  {
    key: 'system',
    label: 'Quản trị hệ thống',
    platform: 'web',
    screens: [
      { key: 'users', name: 'Người dùng & Tài khoản', description: 'Tạo tài khoản, gán vai trò và quản lý quyền hoạt động' },
      { key: 'roles', name: 'Vai trò & Phân quyền', description: 'Định nghĩa vai trò và phân quyền màn hình chức năng' },
      { key: 'config', name: 'Cấu hình hệ thống', description: 'Cài đặt tham số vận hành cốt lõi và tích hợp ngoại vi' },
    ],
  },
];

// ----------------------------------------------------
// 2. ỨNG DỤNG DI ĐỘNG (FSCM MOBILE APP - 23 tính năng)
// ----------------------------------------------------
export const MOBILE_SCREEN_GROUPS: ScreenGroup[] = [
  {
    key: 'mobile-sales',
    label: 'Bán hàng di động (Sales Mobile)',
    platform: 'mobile',
    screens: [
      { key: 'mobile-sales-home', name: 'Trang chủ & Tin tức', description: 'Màn hình tổng quan kết quả bán hàng và bảng tin thị trường' },
      { key: 'mobile-sales-orders', name: 'Đơn đặt hàng đại lý', description: 'Theo dõi trạng thái và tiến độ xử lý đơn đặt hàng đại lý' },
      { key: 'mobile-sales-order-create', name: 'Lập đơn hàng mới tại điểm bán', description: 'Tạo đơn đặt hàng trực tiếp khi viếng thăm điểm bán' },
      { key: 'mobile-sales-scan', name: 'Quét mã QR bán hàng', description: 'Quét QR thùng hàng, tem sản phẩm và kiểm tra khuyến mãi' },
      { key: 'mobile-sales-retailers', name: 'Cửa hàng phụ trách', description: 'Xem danh sách và chi tiết hồ sơ các điểm bán thuộc tuyến' },
      { key: 'mobile-sales-declare', name: 'Khai báo điểm bán mới', description: 'Lập hồ sơ đăng ký đại lý bán lẻ mới và chụp ảnh điểm bán' },
      { key: 'mobile-sales-declarations', name: 'Yêu cầu đã khai báo', description: 'Theo dõi tình trạng phê duyệt các hồ sơ điểm bán đã nộp' },
      { key: 'mobile-sales-products', name: 'Sản phẩm & Tồn kho', description: 'Tra cứu danh mục sản phẩm, bảng giá và số lượng tồn kho' },
      { key: 'mobile-sales-promos', name: 'Chương trình khuyến mãi', description: 'Tra cứu chính sách chiết khấu, khuyến mãi combo và bậc thang' },
      { key: 'mobile-sales-debts', name: 'Công nợ khách hàng', description: 'Theo dõi nợ phải thu, hạn mức tín dụng và hạn thanh toán' },
      { key: 'mobile-sales-kpi', name: 'KPI & Bảng xếp hạng', description: 'Theo dõi tiến độ hoàn thành doanh số tháng và bảng xếp hạng' },
      { key: 'mobile-sales-sync', name: 'Đồng bộ ngoại tuyến (Offline)', description: 'Hàng đợi lưu trữ và tự động đồng bộ đơn hàng khi mất mạng' },
    ],
  },
  {
    key: 'mobile-retailer',
    label: 'Nhà bán lẻ di động (Retailer Mobile)',
    platform: 'mobile',
    screens: [
      { key: 'mobile-rt-orders', name: 'Đơn mua hàng đại lý', description: 'Xem danh sách đơn mua hàng, trạng thái giao vận và hóa đơn' },
      { key: 'mobile-rt-order-create', name: 'Đặt hàng trực tiếp', description: 'Tự tạo đơn đặt hàng nhập hàng FMCG từ nhà phân phối' },
      { key: 'mobile-rt-scan', name: 'Quét QR nhận hàng', description: 'Quét mã QR tem thùng khi nhận hàng để xác thực nguồn gốc' },
      { key: 'mobile-rt-payments', name: 'Thanh toán & Công nợ', description: 'Thanh toán hóa đơn qua cổng PayOS và đối soát công nợ đại lý' },
      { key: 'mobile-rt-loyalty', name: 'Thẻ tích điểm thành viên', description: 'Tích lũy điểm thưởng theo giá trị đơn hàng và xếp hạng thành viên' },
      { key: 'mobile-rt-gifts', name: 'Đổi quà tích điểm', description: 'Chọn quà tặng trong danh mục và gửi yêu cầu đổi điểm thưởng' },
      { key: 'mobile-rt-complaints', name: 'Khiếu nại & Hỗ trợ', description: 'Gửi phản ánh hàng móp méo / sai lệch và yêu cầu thu hồi hàng' },
    ],
  },
  {
    key: 'mobile-warehouse',
    label: 'Kho vận di động (Warehouse Mobile)',
    platform: 'mobile',
    screens: [
      { key: 'mobile-wk-picking', name: 'Lấy hàng theo đơn (Picking)', description: 'Xem danh sách đơn cần nhặt hàng và quét xác nhận từng dòng hàng' },
      { key: 'mobile-wk-operations', name: 'Vận hành quét kho', description: 'Thực hiện kiểm đếm nhập kho, xuất kho và chuyển kho trên mobile' },
      { key: 'mobile-wk-label', name: 'Tra cứu tem kiện hàng', description: 'Quét mã QR tem kiện/lô để kiểm tra thông tin HSD và số lượng thùng' },
      { key: 'mobile-wk-shipped', name: 'Lịch sử phiếu đã xuất', description: 'Tra cứu danh sách các phiếu xuất hàng đã hoàn tất giao dịch' },
    ],
  },
];

// Compatibility exports
export const SCREEN_GROUPS: ScreenGroup[] = WEB_SCREEN_GROUPS;

export const ALL_WEB_SCREEN_KEYS = WEB_SCREEN_GROUPS.flatMap((g) => g.screens.map((s) => s.key));
export const ALL_MOBILE_SCREEN_KEYS = MOBILE_SCREEN_GROUPS.flatMap((g) => g.screens.map((s) => s.key));
export const ALL_SCREEN_KEYS = [...ALL_WEB_SCREEN_KEYS, ...ALL_MOBILE_SCREEN_KEYS];

/** Count known screen grants once; API grants are a separate permission level. */
export function roleScreenGrants(permissions: readonly string[]) {
  const selected = new Set(permissions);
  return {
    web: ALL_WEB_SCREEN_KEYS.filter(key => selected.has(key)),
    mobile: ALL_MOBILE_SCREEN_KEYS.filter(key => selected.has(key)),
  };
}

export const ALL_MOBILE_SALES_KEYS = MOBILE_SCREEN_GROUPS.find((g) => g.key === 'mobile-sales')?.screens.map((s) => s.key) ?? [];
export const ALL_MOBILE_RT_KEYS = MOBILE_SCREEN_GROUPS.find((g) => g.key === 'mobile-retailer')?.screens.map((s) => s.key) ?? [];
export const ALL_MOBILE_WK_KEYS = MOBILE_SCREEN_GROUPS.find((g) => g.key === 'mobile-warehouse')?.screens.map((s) => s.key) ?? [];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  Sales: ALL_MOBILE_SALES_KEYS,
  Retailer: ALL_MOBILE_RT_KEYS,
  WarehouseKeeper: [
    'dashboard',
    'warehouse-inbound',
    'warehouse-factory-requests',
    'warehouse-outbound',
    'warehouse-transfers',
    'batches',
    'warehouse-trace',
    'disposal',
    ...ALL_MOBILE_WK_KEYS,
  ],
  Operator: [
    'dashboard',
    'reports',
    'warehouse-report',
    'orders',
    'allocation',
    'debts',
    'refunds',
    'complaints',
    'batches',
    'readiness',
    'retailers',
    'loyalty',
    'redeem',
    'kpi',
    'fleet',
  ],
  SalesManager: ['dashboard', 'regions', 'kpi'],
  Admin: ALL_SCREEN_KEYS,
};
