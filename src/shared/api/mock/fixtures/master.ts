import type { Db } from './types';

type Master = Pick<Db, 'categories' | 'products' | 'warehouses' | 'areas' | 'groups' | 'salesStaff' | 'retailers' | 'registrations' | 'retailerMlor' | 'retailerDist' | 'whPairs' | 'velocity' | 'vehicles' | 'drivers' | 'transit' | 'settings' | 'users'>;

const P = (sku: string, name: string, cat: string, pack: string, price: number, cost: number, sl: number, near: number, mlor: number) => ({
  sku, name, categoryCode: cat, packSpec: pack, basePrice: price, unitCost: cost, shelfLifeDays: sl, nearExpiryDays: near, defaultMlor: mlor,
  status: 'Published' as const, replaceOf: null, replacedBy: null,
});

const R = (code: string, name: string, address: string, phone: string, areaCode: string, groupCode: string, lat: number, lng: number, source: string, kind: string,
  size: 'S' | 'M' | 'L', areaM2: number, fridges: number, forecastRevenue: number, monthlyCapacity: number, orderFrequency: string, potentialClass: 'A' | 'B' | 'C', creditTermDays: 0 | 7 | 14 | 30, contact: string) => ({
  code, name, address, phone, contact, areaCode, groupCode, lat, lng, status: 'Active' as const, source, kind, size, areaM2, fridges, forecastRevenue, monthlyCapacity, orderFrequency, potentialClass, creditTermDays,
});

export function masterData(): Master {
  return {
    categories: [
      { code: 'CAT-01', name: 'Sữa chua', description: 'Sữa chua ăn, sữa chua uống', status: 'Active' },
      { code: 'CAT-02', name: 'Sữa tươi', description: 'Sữa tươi tiệt trùng, thanh trùng', status: 'Active' },
      { code: 'CAT-03', name: 'Bánh tươi', description: 'Bánh mì, bánh bông lan hạn ngắn', status: 'Active' },
      { code: 'CAT-04', name: 'Đồ mát', description: 'Phô mai, đồ ăn nhanh bảo quản lạnh', status: 'Active' },
      { code: 'CAT-05', name: 'Nước ép tươi', description: 'Dự kiến kinh doanh quý 4', status: 'Active' },
    ],
    products: [
      P('SKU001', 'Sữa chua có đường 100g', 'CAT-01', 'Thùng 48 hộp', 250000, 212000, 45, 10, 0.3),
      P('SKU002', 'Sữa chua uống men sống 65ml', 'CAT-01', 'Thùng 50 chai', 210000, 180000, 30, 7, 0.25),
      P('SKU003', 'Sữa tươi tiệt trùng ít đường 180ml', 'CAT-02', 'Thùng 48 hộp', 320000, 272000, 60, 12, 0.25),
      P('SKU004', 'Sữa tươi thanh trùng 950ml', 'CAT-02', 'Thùng 12 chai', 360000, 306000, 14, 4, 0.3),
      P('SKU005', 'Bánh mì sandwich lát 400g', 'CAT-03', 'Thùng 20 gói', 300000, 255000, 7, 2, 0.3),
      P('SKU006', 'Bánh bông lan kem 55g', 'CAT-03', 'Thùng 60 cái', 270000, 230000, 20, 5, 0.25),
      P('SKU007', 'Phô mai que 120g', 'CAT-04', 'Thùng 24 gói', 540000, 459000, 60, 10, 0.2),
      { ...P('SKU008', 'Sữa chua uống vị dâu 85ml', 'CAT-01', 'Thùng 48 chai', 230000, 195000, 30, 7, 0.25), status: 'Draft' },
      { ...P('SKU009', 'Sữa tươi thanh trùng 950ml (thùng 10 chai)', 'CAT-02', 'Thùng 10 chai', 300000, 255000, 14, 4, 0.3), status: 'Inactive', replacedBy: 'SKU004' },
    ],
    warehouses: [
      { code: 'WH-TA', name: 'Kho Thới An', address: 'P. Thới An, Q.12', lat: 10.8744, lng: 106.6511, type: 'Regional', keeperName: 'Đỗ Văn Tâm', capacityPallets: 400, status: 'Active' },
      { code: 'WH-TCH', name: 'Kho Tân Chánh Hiệp', address: 'P. Tân Chánh Hiệp, Q.12', lat: 10.8632, lng: 106.6208, type: 'Regional', keeperName: 'Ngô Thị Lan', capacityPallets: 350, status: 'Active' },
      { code: 'WH-GV', name: 'Kho Gò Vấp', address: 'P. 14, Q. Gò Vấp', lat: 10.8421, lng: 106.6613, type: 'Regional', keeperName: 'Bùi Quang Minh', capacityPallets: 300, status: 'Active' },
      { code: 'WH-TD', name: 'Kho Thủ Đức', address: 'P. Linh Trung, TP. Thủ Đức', lat: 10.8696, lng: 106.7791, type: 'Regional', keeperName: 'Lý Hoàng Nam', capacityPallets: 320, status: 'Active' },
      { code: 'WH-CC', name: 'Kho Củ Chi', address: 'Xã Tân Thông Hội, H. Củ Chi', lat: 10.9741, lng: 106.4932, type: 'Central', keeperName: 'Trịnh Văn Hậu', capacityPallets: 1200, status: 'Active' },
      // Extra demo warehouse far from Gò Vấp (> Dmax_kho) so the rotation trace shows a "> 40 km" rejection.
      { code: 'WH-CG', name: 'Kho Cần Giờ', address: 'Xã Bình Khánh, H. Cần Giờ', lat: 10.6081, lng: 106.7894, type: 'Regional', keeperName: 'Võ Thanh Hải', capacityPallets: 150, status: 'Active' },
    ],
    areas: [
      { code: 'Q12', name: 'Quận 12', region: 'Miền Nam', managerName: 'Hồ Gia Bảo', wards: ['Thới An', 'Tân Chánh Hiệp', 'Hiệp Thành', 'Thạnh Lộc'] },
      { code: 'HM', name: 'Hóc Môn', region: 'Miền Nam', managerName: 'Hồ Gia Bảo', wards: ['Xuân Thới Thượng'] },
      { code: 'GV', name: 'Gò Vấp', region: 'Miền Nam', managerName: 'Hồ Gia Bảo', wards: ['Phường 10'] },
    ],
    groups: [
      { code: 'Q12-A', areaCode: 'Q12', managerName: 'Hồ Gia Bảo', members: ['Nguyễn Văn An', 'Trần Thị Bình', 'Võ Quốc Huy', 'Huỳnh Gia Bảo'] },
      { code: 'Q12-B', areaCode: 'Q12', managerName: 'Hồ Gia Bảo', members: ['Lê Minh Hoàng', 'Phạm Thu Hà', 'Đặng Mỹ Linh', 'Ngô Thanh Tâm'] },
    ],
    salesStaff: ['Nguyễn Văn An', 'Trần Thị Bình', 'Võ Quốc Huy', 'Huỳnh Gia Bảo', 'Lê Minh Hoàng', 'Phạm Thu Hà', 'Đặng Mỹ Linh', 'Ngô Thanh Tâm'],
    retailers: [
      R('10004127', 'Tạp hóa Minh Châu', '12 Lê Văn Khương, P. Thới An, Q.12', '0909 555 127', 'Q12', 'Q12-A', 10.8689, 106.6538, 'Admin import', 'Tạp hóa', 'M', 40, 2, 60000000, 120, '2 lần/tuần', 'A', 14, 'Chị Minh Châu'),
      R('10004135', 'Siêu thị mini Hòa Bình', '45 Tô Ký, P. Tân Chánh Hiệp, Q.12', '0908 412 135', 'Q12', 'Q12-A', 10.8601, 106.6197, 'Admin import', 'Siêu thị mini', 'L', 85, 4, 95000000, 180, '3 lần/tuần', 'A', 30, 'Anh Hòa Bình'),
      R('10004182', 'Cửa hàng tiện lợi An Phú', '88 Nguyễn Ảnh Thủ, P. Hiệp Thành, Q.12', '0937 220 182', 'Q12', 'Q12-A', 10.8794, 106.6412, 'Admin import', 'Cửa hàng tiện lợi', 'M', 50, 3, 70000000, 130, '2 lần/tuần', 'A', 14, 'Chị An Phú'),
      R('10004219', 'Tạp hóa Thanh Xuân', '210 Hà Huy Giáp, P. Thạnh Lộc, Q.12', '0903 118 219', 'Q12', 'Q12-B', 10.8873, 106.6721, 'Admin import', 'Tạp hóa', 'S', 25, 1, 30000000, 60, '1 lần/tuần', 'B', 7, 'Cô Thanh Xuân'),
      R('10004256', 'Tạp hóa Ngọc Lan', '19 Phan Văn Hớn, X. Xuân Thới Thượng, Hóc Môn', '0918 222 105', 'HM', 'Q12-B', 10.8905, 106.5969, 'Sales Nguyễn Văn An khai báo', 'Tạp hóa', 'S', 20, 1, 18000000, 35, '1 lần/tuần', 'C', 0, 'Cô Ngọc Lan'),
      R('10004288', 'Bách hóa Tâm An', '102 Quang Trung, P. 10, Gò Vấp', '0977 310 884', 'GV', 'Q12-A', 10.8362, 106.6676, 'Sales Nguyễn Văn An khai báo', 'Tạp hóa', 'M', 35, 2, 40000000, 80, '1 lần/tuần', 'B', 7, 'Chú Tâm An'),
    ],
    registrations: [
      { code: 'KB-0012', name: 'Tạp hóa Hải Yến', address: '31 Trường Chinh, P. Tân Thới Nhất, Q.12', phone: '0903 456 789', contact: 'Chị Hải Yến', areaCode: 'Q12', kind: 'Tạp hóa', size: 'M',
        forecastRevenue: 45000000, monthlyCapacity: 90, salesName: 'Nguyễn Văn An', createdAt: '2026-09-26T16:20', status: 'Pending', retailerCode: null, rejectReason: null },
    ],
    retailerMlor: {},
    retailerDist: {
      '10004127': { 'WH-TA': 3.2, 'WH-TCH': 6.5, 'WH-GV': 9.8, 'WH-TD': 17.4, 'WH-CC': 28.6, 'WH-CG': 44.0 },
      '10004135': { 'WH-TA': 5.1, 'WH-TCH': 1.8, 'WH-GV': 8.7, 'WH-TD': 14.2, 'WH-CC': 24.9, 'WH-CG': 41.5 },
      '10004182': { 'WH-TA': 4.4, 'WH-TCH': 3.9, 'WH-GV': 11.6, 'WH-TD': 12.8, 'WH-CC': 26.3, 'WH-CG': 43.2 },
      '10004219': { 'WH-TA': 6.0, 'WH-TCH': 7.7, 'WH-GV': 12.3, 'WH-TD': 9.6, 'WH-CC': 31.2, 'WH-CG': 40.8 },
      '10004256': { 'WH-TA': 7.8, 'WH-TCH': 9.6, 'WH-GV': 14.9, 'WH-TD': 22.5, 'WH-CC': 17.3, 'WH-CG': 52.0 },
      '10004288': { 'WH-TA': 8.9, 'WH-TCH': 11.4, 'WH-GV': 2.6, 'WH-TD': 15.8, 'WH-CC': 33.0, 'WH-CG': 38.5 },
    },
    whPairs: [
      ['WH-GV', 'WH-TA', 9], ['WH-GV', 'WH-TCH', 5], ['WH-GV', 'WH-TD', 25], ['WH-GV', 'WH-CC', 33], ['WH-TA', 'WH-TCH', 4], ['WH-TA', 'WH-TD', 18],
      ['WH-TA', 'WH-CC', 26], ['WH-TCH', 'WH-TD', 15], ['WH-TCH', 'WH-CC', 24], ['WH-TD', 'WH-CC', 38],
      ['WH-GV', 'WH-CG', 45], ['WH-TA', 'WH-CG', 52], ['WH-TCH', 'WH-CG', 55], ['WH-TD', 'WH-CG', 42], ['WH-CC', 'WH-CG', 68],
    ],
    // velocity[warehouse][sku] = [[v (cases/day), m, label], …]  (customer groups of the warehouse area)
    velocity: {
      'WH-GV': { SKU002: [[4, 0.25, 'Nhóm khách m = 0,25 (3 điểm bán)'], [2, 0.15, 'Nhóm khách m = 0,15 (2 điểm bán)']], SKU003: [[3, 0.25, 'Nhóm khách m = 0,25 (4 điểm bán)']] },
      'WH-TA': { SKU002: [[12, 0.25, 'Nhóm khách m = 0,25 (6 điểm bán)']], SKU003: [[6, 0.25, 'Nhóm khách m = 0,25 (5 điểm bán)']] },
      'WH-TCH': { SKU002: [[10, 0.3, 'Nhóm khách m = 0,30 (5 điểm bán)']], SKU003: [[5, 0.25, 'Nhóm khách m = 0,25 (4 điểm bán)']] },
      'WH-TD': { SKU002: [[8, 0.25, 'Nhóm khách m = 0,25 (4 điểm bán)']], SKU003: [[4, 0.25, 'Nhóm khách m = 0,25 (3 điểm bán)']] },
      'WH-CC': {},
      'WH-CG': {},
    },
    vehicles: [
      { plate: '51C-482.17', type: 'Xe tải lạnh 1,5 tấn', capacity: 120, warehouseCode: 'WH-TA', status: 'Active' },
      { plate: '51D-209.33', type: 'Xe tải lạnh 1 tấn', capacity: 80, warehouseCode: 'WH-TCH', status: 'Active' },
      { plate: '51C-617.05', type: 'Xe tải 2,5 tấn thùng cách nhiệt', capacity: 200, warehouseCode: 'WH-CC', status: 'Active' },
      { plate: '59C-338.21', type: 'Xe tải lạnh 1 tấn', capacity: 80, warehouseCode: 'WH-GV', status: 'Maintenance' },
    ],
    drivers: [
      { code: 'NG-001', name: 'Trương Văn Lực', phone: '0907 118 552', licenseClass: 'C', status: 'Active' },
      { code: 'NG-002', name: 'Phan Thanh Sơn', phone: '0938 402 117', licenseClass: 'C', status: 'Active' },
      { code: 'NG-003', name: 'Lê Hữu Phước', phone: '0912 775 304', licenseClass: 'C', status: 'Active' },
      { code: 'NG-004', name: 'Đinh Công Tú', phone: '0983 210 446', licenseClass: 'B2', status: 'OnLeave' },
    ],
    transit: {
      validFrom: '2026-09-01',
      bands: [
        { fromKm: 0, toKm: 10, days: 1, cost: 300000, scope: 'RetailerAndWarehouse' },
        { fromKm: 10, toKm: 20, days: 2, cost: 500000, scope: 'RetailerAndWarehouse' },
        { fromKm: 20, toKm: 40, days: 3, cost: 800000, scope: 'WarehouseOnly' },
      ],
    },
    settings: {
      allocation: { wE: 0.5, wD: 0.3, wQ: 0.2 },
      dmaxRetailerKm: 20,
      dmaxWarehouseKm: 40,
      rotation: { wE: 0.5, wD: 0.3, wQ: 0.2, velocityDays: 14, minQty: 10, roundTo: 10 },
      minRegionalStock: 35,
      batchDiscountTiers: [{ maxRemainingPct: 60, discountPct: 5 }, { maxRemainingPct: 40, discountPct: 10 }, { maxRemainingPct: 30, discountPct: 15 }],
      loyaltyPointRateVnd: 100000,
    },
    users: [
      { id: 'khoa.pm@fscm.local', name: 'Phạm Minh Khoa', loginName: 'khoa.pm@fscm.local', role: 'Admin', scope: '—', status: 'Active', lastLoginAt: '2026-09-27T08:02' },
      { id: 'trang.lt@fscm.local', name: 'Lý Thu Trang', loginName: 'trang.lt@fscm.local', role: 'Operator', scope: '—', status: 'Active', lastLoginAt: '2026-09-27T08:15' },
      { id: 'bao.hg@fscm.local', name: 'Hồ Gia Bảo', loginName: 'bao.hg@fscm.local', role: 'SalesManager', scope: 'Quận 12', status: 'Active', lastLoginAt: '2026-09-26T17:40' },
      { id: '0912 440 118', name: 'Đỗ Văn Tâm', loginName: '0912 440 118', role: 'WarehouseKeeper', scope: 'Kho Thới An', status: 'Active', lastLoginAt: '2026-09-27T07:05' },
      { id: '0909 123 456', name: 'Nguyễn Văn An', loginName: '0909 123 456', role: 'Sales', scope: 'Q12-A', status: 'Active', lastLoginAt: '2026-09-27T07:45' },
      { id: '0909 555 127', name: 'Tạp hóa Minh Châu', loginName: '0909 555 127', role: 'Retailer', scope: '10004127', status: 'Active', lastLoginAt: '2026-09-27T09:20' },
    ],
  };
}
