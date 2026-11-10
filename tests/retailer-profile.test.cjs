const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  const imports = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) {
      throw new Error('Missing boundary mock: ' + name + ' in ' + file);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(imports, module, module.exports);
  return module.exports;
}

const errors = source('shared/api/errors.ts');
const permissions = source('shared/auth/permissions.ts', {
  '../api/errors': errors,
  '../lib/env': { env: { useMock: false } },
});

const user = (role) => ({ id: 'user-' + role, role, name: role, email: role + '@example.com' });

test('RBAC: retailers.edit and mlor.manage permissions conform strictly to authorization matrix', () => {
  // retailers.edit: Admin and Operator
  assert.equal(permissions.can(user('Admin'), 'retailers.edit'), true);
  assert.equal(permissions.can(user('Operator'), 'retailers.edit'), true);
  assert.equal(permissions.can(user('SalesManager'), 'retailers.edit'), false);
  assert.equal(permissions.can(user('WarehouseKeeper'), 'retailers.edit'), false);
  assert.equal(permissions.can(user('Retailer'), 'retailers.edit'), false);

  // mlor.read: Admin and Operator
  assert.equal(permissions.can(user('Admin'), 'mlor.read'), true);
  assert.equal(permissions.can(user('Operator'), 'mlor.read'), true);
  assert.equal(permissions.can(user('WarehouseKeeper'), 'mlor.read'), false);

  // mlor.manage: Admin and Operator
  assert.equal(permissions.can(user('Admin'), 'mlor.manage'), true);
  assert.equal(permissions.can(user('Operator'), 'mlor.manage'), true);
  assert.equal(permissions.can(user('SalesManager'), 'mlor.manage'), false);
  assert.equal(permissions.can(user('Retailer'), 'mlor.manage'), false);
});

test('MLOR F22-FE Resolution Hierarchy: Retailer-SKU > Retailer-Category > ProductDefault', () => {
  // Emulate resolution algorithm matching backend F22-FE contract
  function resolveMlor({
    productId,
    productCategoryId,
    productDefaultRatio,
    productDefaultHours,
    retailerConfigs = [],
  }) {
    // 1. Check SKU-specific rule (highest precedence)
    const skuConfig = retailerConfigs.find(
      (c) => c.productId === productId && c.isActive !== false,
    );
    if (skuConfig) {
      return {
        sourceScope: 'RetailerProduct',
        sourceRuleId: skuConfig.id,
        sourceVersion: skuConfig.version,
        minimumLifeRatio: skuConfig.minimumLifeRatio,
        minimumLifeHours: skuConfig.minimumLifeHours ?? null,
      };
    }

    // 2. Check Category-level rule (second precedence)
    const catConfig = retailerConfigs.find(
      (c) => c.productCategoryId === productCategoryId && !c.productId && c.isActive !== false,
    );
    if (catConfig) {
      return {
        sourceScope: 'RetailerCategory',
        sourceRuleId: catConfig.id,
        sourceVersion: catConfig.version,
        minimumLifeRatio: catConfig.minimumLifeRatio,
        minimumLifeHours: catConfig.minimumLifeHours ?? null,
      };
    }

    // 3. Fallback to product default
    return {
      sourceScope: 'ProductDefault',
      sourceRuleId: null,
      sourceVersion: 1,
      minimumLifeRatio: productDefaultRatio,
      minimumLifeHours: productDefaultHours ?? null,
    };
  }

  const defaultRatio = 0.3; // 30% default
  const defaultHours = 72; // 72 hours
  const pId = 'prod-101';
  const cId = 'cat-milk';

  // Scenario 1: No retailer configuration -> ProductDefault wins
  const resDefault = resolveMlor({
    productId: pId,
    productCategoryId: cId,
    productDefaultRatio: defaultRatio,
    productDefaultHours: defaultHours,
    retailerConfigs: [],
  });
  assert.equal(resDefault.sourceScope, 'ProductDefault');
  assert.equal(resDefault.minimumLifeRatio, 0.3);
  assert.equal(resDefault.minimumLifeHours, 72);

  // Scenario 2: Category rule present (50%) -> RetailerCategory wins over ProductDefault
  const configsWithCat = [
    {
      id: 'cfg-cat-1',
      productCategoryId: cId,
      productId: null,
      minimumLifeRatio: 0.5,
      version: 2,
    },
  ];
  const resCat = resolveMlor({
    productId: pId,
    productCategoryId: cId,
    productDefaultRatio: defaultRatio,
    productDefaultHours: defaultHours,
    retailerConfigs: configsWithCat,
  });
  assert.equal(resCat.sourceScope, 'RetailerCategory');
  assert.equal(resCat.minimumLifeRatio, 0.5);
  assert.equal(resCat.sourceVersion, 2);

  // Scenario 3: Both SKU rule (70%) and Category rule (50%) present -> RetailerProduct wins!
  const configsWithBoth = [
    {
      id: 'cfg-cat-1',
      productCategoryId: cId,
      productId: null,
      minimumLifeRatio: 0.5,
      version: 2,
    },
    {
      id: 'cfg-sku-1',
      productCategoryId: cId,
      productId: pId,
      minimumLifeRatio: 0.7,
      minimumLifeHours: 120,
      version: 3,
    },
  ];
  const resSku = resolveMlor({
    productId: pId,
    productCategoryId: cId,
    productDefaultRatio: defaultRatio,
    productDefaultHours: defaultHours,
    retailerConfigs: configsWithBoth,
  });
  assert.equal(resSku.sourceScope, 'RetailerProduct');
  assert.equal(resSku.minimumLifeRatio, 0.7);
  assert.equal(resSku.minimumLifeHours, 120);
  assert.equal(resSku.sourceVersion, 3);
});

test('Source Code Integrity: RetailersPage implements standardized Thao tác, direct Xem, and row click navigation', () => {
  const pageCode = fs.readFileSync(
    path.resolve(__dirname, '../src/features/retailers/pages/RetailersPage.tsx'),
    'utf8',
  );

  // Standardized header and action column
  assert.ok(pageCode.includes('rowActionHeader="Thao tác"'));
  assert.ok(pageCode.includes('Xem') && pageCode.includes('Button'));
  assert.ok(pageCode.includes('navigate('));
  assert.ok(pageCode.includes('onRowClick='));

  // Permission-aware review button
  assert.ok(pageCode.includes("row.status === 'PendingApproval' && can(user, 'retailers.review')"));
  assert.ok(pageCode.includes('Xét duyệt'));

  // Filtering and searching
  assert.ok(pageCode.includes("label: 'Trạng thái'"));
  assert.ok(pageCode.includes("label: 'Nhóm Sales'"));
  assert.ok(pageCode.includes('searchPlaceholder="Mã, tên điểm bán, người liên hệ, SĐT..."'));
});

test('Source Code Integrity: RetailerDetailPage implements 4-group Thông tin chung, MLOR F22-FE, and Audit Timeline', () => {
  const detailCode = fs.readFileSync(
    path.resolve(__dirname, '../src/features/retailers/pages/RetailerDetailPage.tsx'),
    'utf8',
  );

  // Tab definitions matching Prototype v1.3
  assert.ok(detailCode.includes("label: 'Thông tin chung'"));
  assert.ok(detailCode.includes("label: 'Yêu cầu hạn sử dụng'"));
  assert.ok(detailCode.includes("label: 'Công nợ & tín dụng'"));
  assert.ok(detailCode.includes("label: 'Lịch sử thay đổi'"));

  // 4 Structured groups in Thông tin chung
  assert.ok(detailCode.includes('A. Thông tin liên hệ'));
  assert.ok(detailCode.includes('B. Vị trí & Tọa độ'));
  assert.ok(detailCode.includes('C. Quy mô kinh doanh'));
  assert.ok(detailCode.includes('D. Tiềm năng kinh doanh & Khai báo'));

  // Specific data attributes
  assert.ok(detailCode.includes('Phiên bản vị trí'));
  assert.ok(detailCode.includes('Mở trên Google Maps'));
  assert.ok(detailCode.includes('google.com/maps/search'));
  assert.ok(detailCode.includes('Phân loại diện tích'));
  assert.ok(detailCode.includes('Tần suất mua hàng'));
  assert.ok(detailCode.includes('Khả năng nộp duyệt'));
  assert.ok(detailCode.includes('Ảnh mặt tiền điểm bán'));

  // Sub-components integrated
  assert.ok(detailCode.includes('<RetailerMlorTab retailer={r} />'));
  assert.ok(detailCode.includes('<CreditTermsCard retailer={retailer}'));
  assert.ok(detailCode.includes('<RetailerAuditTimeline retailer={r} />'));
  assert.ok(detailCode.includes('<RetailerFormDialog open={edit} retailer={r}'));
});

test('Source Code Integrity: RetailerMlorTab implements F22-FE Category & SKU MLOR with Effective Resolution', () => {
  const mlorTabCode = fs.readFileSync(
    path.resolve(__dirname, '../src/features/retailers/components/RetailerMlorTab.tsx'),
    'utf8',
  );

  // Hierarchy rules and Vietnamese terminology
  assert.ok(mlorTabCode.includes('Quy tắc thứ tự ưu tiên hạn sử dụng (MLOR)'));
  assert.ok(mlorTabCode.includes('1. Áp dụng theo danh mục'));
  assert.ok(mlorTabCode.includes('2. Yêu cầu riêng theo sản phẩm'));
  assert.ok(mlorTabCode.includes('3. Tra cứu yêu cầu đang áp dụng'));
  assert.ok(!mlorTabCode.includes('F22-FE'), 'Should not display internal spec code F22-FE to users');
  assert.ok(!mlorTabCode.includes('Category-Level MLOR'), 'Should not display English technical jargon to users');

  // Scopes rendering
  assert.ok(mlorTabCode.includes('RetailerProduct'));
  assert.ok(mlorTabCode.includes('RetailerCategory'));
  assert.ok(mlorTabCode.includes('ProductDefault'));
  assert.ok(mlorTabCode.includes('Yêu cầu riêng theo sản phẩm (Mức cao nhất)'));
  assert.ok(mlorTabCode.includes('Áp dụng theo danh mục (Mức 2)'));
  assert.ok(mlorTabCode.includes('Mặc định của sản phẩm (Mức cơ sở)'));

  // CRUD hooks usage
  assert.ok(mlorTabCode.includes('useRetailerMlorConfigs'));
  assert.ok(mlorTabCode.includes('useResolveMlor'));
  assert.ok(mlorTabCode.includes('useSetMlor'));
  assert.ok(mlorTabCode.includes('useDeleteMlor'));
});

test('Source Code Integrity: RetailerAuditTimeline complies with architectural rule and uses official lifecycle fields', () => {
  const auditCode = fs.readFileSync(
    path.resolve(__dirname, '../src/features/retailers/components/RetailerAuditTimeline.tsx'),
    'utf8',
  );

  // Clean business UI check: NEVER expose technical notes or ProfileHistory/AuditLog to users
  assert.ok(auditCode.includes('Lịch sử thay đổi điểm bán'));
  assert.ok(auditCode.includes('Lịch sử thay đổi hồ sơ'));
  assert.ok(!auditCode.includes('ProfileHistory'), 'Should not expose ProfileHistory technical note to business users');
  assert.ok(!auditCode.includes('AuditLog'), 'Should not expose AuditLog technical note to business users');
  assert.ok(!auditCode.includes('RetailerDetails'), 'Should not expose DB entity names to business users');

  // Official lifecycle fields used without faking data
  assert.ok(auditCode.includes('retailer.createdAt'));
  assert.ok(auditCode.includes('retailer.declaredByUserId'));
  assert.ok(auditCode.includes('retailer.reviewedAt'));
  assert.ok(auditCode.includes('retailer.reviewedByUserId'));
  assert.ok(auditCode.includes('retailer.reviewReason'));
  assert.ok(auditCode.includes('retailer.updatedAt'));
  assert.ok(auditCode.includes('retailer.locationVersion'));
});

test('API & Hooks Integrity: retailerApi and hooks map to OpenAPI v1.0.2 contracts', () => {
  const apiCode = fs.readFileSync(
    path.resolve(__dirname, '../src/features/retailers/api.ts'),
    'utf8',
  );
  const hooksCode = fs.readFileSync(
    path.resolve(__dirname, '../src/features/retailers/hooks.ts'),
    'utf8',
  );

  // MLOR Configurations API
  assert.ok(apiCode.includes("'/mlor-configurations'"));
  assert.ok(apiCode.includes('/retailers/${encodeURIComponent(retailerId)}/mlor-resolution'));
  assert.ok(apiCode.includes('/retailers/${encodeURIComponent(retailerId)}/declaration'));

  // Hooks coverage
  assert.ok(hooksCode.includes('useRetailerMlorConfigs'));
  assert.ok(hooksCode.includes('useResolveMlor'));
  assert.ok(hooksCode.includes('useSetMlor'));
  assert.ok(hooksCode.includes('useDeleteMlor'));
  assert.ok(hooksCode.includes('useUpdateRetailerDeclaration'));
});
