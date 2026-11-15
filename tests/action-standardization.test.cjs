const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const regionsPageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/regions/pages/RegionsPage.tsx'), 'utf8');
const warehousesPageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/warehouses/pages/WarehousesPage.tsx'), 'utf8');
const regionWarehousesPageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/warehouses/pages/RegionWarehousesPage.tsx'), 'utf8');
const warehouseDetailPageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/warehouses/pages/WarehouseDetailPage.tsx'), 'utf8');
const groupDetailPageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/regions/pages/GroupDetailPage.tsx'), 'utf8');

test('Region deactivation blocking message complies with mandatory business rule', () => {
  const mandatoryWarning = 'Không thể ngừng hoạt động khu vực này vì vẫn còn nhóm Sales đang hoạt động.';
  assert.ok(
    regionsPageCode.includes(mandatoryWarning),
    `RegionsPage.tsx must include exact warning: "${mandatoryWarning}"`
  );
});

test('WarehousesPage standardizes action columns with [Xem] + ActionDropdown and "Thao tác" header', () => {
  assert.ok(warehousesPageCode.includes('rowActionHeader="Thao tác"'));
  assert.ok(warehousesPageCode.includes('ActionDropdown'));
  assert.ok(warehousesPageCode.includes('<span>Xem</span>'));
  assert.ok(warehousesPageCode.includes('#1D4ED8')); // Chỉnh sửa
  assert.ok(warehousesPageCode.includes('#C2410C')); // Ngừng hoạt động
  assert.ok(warehousesPageCode.includes('#15803D')); // Kích hoạt lại
});

test('RegionWarehousesPage standardizes action columns with [Xem] + ActionDropdown and "Thao tác" header', () => {
  assert.ok(regionWarehousesPageCode.includes('rowActionHeader="Thao tác"'));
  assert.ok(regionWarehousesPageCode.includes('ActionDropdown'));
  assert.ok(regionWarehousesPageCode.includes('<span>Xem</span>'));
  assert.ok(regionWarehousesPageCode.includes('#1D4ED8')); // Chỉnh sửa
  assert.ok(regionWarehousesPageCode.includes('#C2410C')); // Ngừng hoạt động
  assert.ok(regionWarehousesPageCode.includes('#15803D')); // Kích hoạt lại
});

test('RegionsPage standardizes both sales groups and areas tables with [Xem] + ActionDropdown and "Thao tác" header', () => {
  assert.ok(regionsPageCode.includes('rowActionHeader="Thao tác"'));
  assert.ok(regionsPageCode.includes('ActionDropdown'));
  assert.ok(regionsPageCode.includes('<span>Xem</span>'));
  assert.ok(regionsPageCode.includes('#1D4ED8')); // Chỉnh sửa
  assert.ok(regionsPageCode.includes('#C2410C')); // Ngừng hoạt động
  assert.ok(regionsPageCode.includes('#15803D')); // Kích hoạt lại
  assert.ok(regionsPageCode.includes('#B42318')); // Xóa
});

test('Nested detail tables provide standardized "Thao tác" actions', () => {
  assert.ok(warehouseDetailPageCode.includes("header: 'Thao tác'"));
  assert.ok(warehouseDetailPageCode.includes('<span>Xem</span>'));
  assert.ok(groupDetailPageCode.includes("header: 'Thao tác'"));
  assert.ok(groupDetailPageCode.includes('<span>Xem</span>'));
});

test('All user-facing occurrences of "Vùng kho" are replaced with "Vùng hoạt động"', () => {
  const warehouseFormPageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/warehouses/pages/WarehouseFormPage.tsx'), 'utf8');
  assert.equal(/vùng\s+kho/i.test(warehousesPageCode), false, 'WarehousesPage must not contain "vùng kho"');
  assert.equal(/vùng\s+kho/i.test(regionWarehousesPageCode), false, 'RegionWarehousesPage must not contain "vùng kho"');
  assert.equal(/vùng\s+kho/i.test(warehouseDetailPageCode), false, 'WarehouseDetailPage must not contain "vùng kho"');
  assert.equal(/vùng\s+kho/i.test(warehouseFormPageCode), false, 'WarehouseFormPage must not contain "vùng kho"');

  assert.ok(warehousesPageCode.includes('Danh sách vùng hoạt động'));
  assert.ok(warehousesPageCode.includes('Thêm vùng hoạt động'));
  assert.ok(warehousesPageCode.includes('Tên vùng hoạt động'));
  assert.ok(warehousesPageCode.includes('Tất cả vùng hoạt động'));
  assert.ok(regionWarehousesPageCode.includes('Vùng hoạt động: '));
  assert.ok(warehouseDetailPageCode.includes('Vùng hoạt động: '));
  assert.ok(warehouseFormPageCode.includes('Vui lòng chọn vùng hoạt động.'));
  assert.ok(warehouseFormPageCode.includes('Chọn vùng hoạt động'));
});


