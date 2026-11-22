export interface RoleItem {
  id: string;
  code: string;
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
  permissions: string[];
}

export interface UpdateRoleInput {
  name: string;
  description?: string;
  permissions: string[];
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
  screens: {
    key: string;
    name: string;
    description: string;
  }[];
}

export const SCREEN_GROUPS: ScreenGroup[] = [
  {
    key: 'overview',
    label: 'Tổng quan & Báo cáo',
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
    screens: [
      { key: 'warehouse-inbound', name: 'Nhập kho (PNK)', description: 'Lập và kiểm duyệt chứng từ nhập hàng vào kho' },
      { key: 'warehouse-outbound', name: 'Xuất kho (PXK)', description: 'Lập và kiểm duyệt chứng từ xuất hàng ra khỏi kho' },
      { key: 'warehouse-transfers', name: 'Luân chuyển kho', description: 'Quản lý phiếu chuyển kho nội bộ giữa các chi nhánh' },
      { key: 'batches', name: 'Quản lý lô hàng', description: 'Theo dõi thông tin chi tiết lô, HSD và in mã QR thùng hàng' },
      { key: 'warehouse-trace', name: 'Tra cứu kiện / thùng', description: 'Quét mã QR tra cứu lịch sử luân chuyển kiện thùng hàng' },
      { key: 'readiness', name: 'Điều phối giao hàng', description: 'Chuẩn bị kiện hàng, phân bổ phương tiện và tài xế' },
      { key: 'batchpromo', name: 'Giảm giá theo HSD', description: 'Thiết lập chính sách giảm giá cho các lô hàng cận date' },
      { key: 'disposal', name: 'Hủy hàng hết hạn', description: 'Biên bản tiêu hủy và xử lý hàng hóa quá hạn sử dụng' },
      { key: 'fleet', name: 'Xe & Tài xế', description: 'Quản lý danh mục phương tiện vận tải và tài xế giao hàng' },
    ],
  },
  {
    key: 'customer',
    label: 'Khách hàng & Khuyến mãi',
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
    screens: [
      { key: 'users', name: 'Người dùng & Tài khoản', description: 'Tạo tài khoản, gán vai trò và quản lý quyền hoạt động' },
      { key: 'roles', name: 'Vai trò & Phân quyền', description: 'Định nghĩa vai trò và phân quyền màn hình chức năng' },
      { key: 'config', name: 'Cấu hình hệ thống', description: 'Cài đặt tham số vận hành cốt lõi và tích hợp ngoại vi' },
    ],
  },
];

export const ALL_SCREEN_KEYS = SCREEN_GROUPS.flatMap((g) => g.screens.map((s) => s.key));
