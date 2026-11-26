const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const regionsPageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/regions/pages/RegionsPage.tsx'), 'utf8');
const warehousesPageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/warehouses/pages/WarehousesPage.tsx'), 'utf8');
const regionWarehousesPageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/warehouses/pages/RegionWarehousesPage.tsx'), 'utf8');
const warehouseDetailPageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/warehouses/pages/WarehouseDetailPage.tsx'), 'utf8');
const warehouseFormPageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/warehouses/pages/WarehouseFormPage.tsx'), 'utf8');
const warehouseApiCode = fs.readFileSync(path.resolve(__dirname, '../src/features/warehouses/api.ts'), 'utf8');
const groupDetailPageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/regions/pages/GroupDetailPage.tsx'), 'utf8');

test('Region deactivation blocking message complies with mandatory business rule', () => {
  const mandatoryWarning = 'Không thể ngừng hoạt động khu vực này vì vẫn còn nhóm bán hàng đang hoạt động.';
  assert.ok(
    regionsPageCode.includes(mandatoryWarning),
    `RegionsPage.tsx must include exact warning: "${mandatoryWarning}"`
  );
});

test('WarehousesPage standardizes action columns with ActionDropdown, onRowClick, and "Thao tác" header', () => {
  assert.ok(warehousesPageCode.includes('rowActionHeader="Thao tác"'));
  assert.ok(warehousesPageCode.includes('ActionDropdown'));
  assert.ok(warehousesPageCode.includes('onRowClick='));
  assert.ok(warehousesPageCode.includes('#1D4ED8')); // Chỉnh sửa
  assert.ok(warehousesPageCode.includes('#C2410C')); // Ngừng hoạt động
  assert.ok(warehousesPageCode.includes('#15803D')); // Kích hoạt lại
});

test('RegionWarehousesPage standardizes action columns with ActionDropdown, onRowClick, and "Thao tác" header', () => {
  assert.ok(regionWarehousesPageCode.includes('rowActionHeader="Thao tác"'));
  assert.ok(regionWarehousesPageCode.includes('ActionDropdown'));
  assert.ok(regionWarehousesPageCode.includes('onRowClick='));
  assert.ok(regionWarehousesPageCode.includes('#1D4ED8')); // Chỉnh sửa
  assert.ok(regionWarehousesPageCode.includes('#C2410C')); // Ngừng hoạt động
  assert.ok(regionWarehousesPageCode.includes('#15803D')); // Kích hoạt lại
});

test('RegionsPage standardizes both sales groups and areas tables with ActionDropdown, onRowClick, and "Thao tác" header', () => {
  assert.ok(regionsPageCode.includes('rowActionHeader="Thao tác"'));
  assert.ok(regionsPageCode.includes('ActionDropdown'));
  assert.ok(regionsPageCode.includes('onRowClick='));
  assert.ok(regionsPageCode.includes('#1D4ED8')); // Chỉnh sửa
  assert.ok(regionsPageCode.includes('#C2410C')); // Ngừng hoạt động
  assert.ok(regionsPageCode.includes('#15803D')); // Kích hoạt lại
  assert.ok(regionsPageCode.includes('#B42318')); // Xóa
});

test('Nested detail tables provide standardized onRowClick actions', () => {
  assert.ok(warehouseDetailPageCode.includes("onRowClick="));
  assert.ok(warehouseDetailPageCode.includes('navigate(`/retailers/${retailer.retailerId || retailer.retailerCode}`)'));
  assert.ok(groupDetailPageCode.includes("onRowClick="));
});

test('All user-facing occurrences of "Vùng kho" are replaced with "Vùng hoạt động"', () => {
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

test('UT-Warehouse Config-UTCID01/02: Admin warehouse form requires Region and sends no hierarchy or central flags', () => {
  assert.ok(warehouseFormPageCode.includes("regionId: ''"));
  assert.ok(warehouseFormPageCode.includes("if (!form.regionId) nextErr.regionId = ['Vui lòng chọn vùng hoạt động.'];"));
  assert.ok(warehouseFormPageCode.includes('regionId: form.regionId'));

  const createPayload = warehouseApiCode.slice(
    warehouseApiCode.indexOf('// OpenAPI CreateWarehouseRequest:'),
    warehouseApiCode.indexOf('const res = await post<RawWarehouse>("/warehouses"'),
  );
  assert.ok(createPayload.includes('regionId: body.regionId'));
  assert.equal(/parentWarehouseId|warehouseType|isCentral/i.test(createPayload), false);
});


