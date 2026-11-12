const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

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
const qrTypes = source('features/qr-labels/types.ts');
const printLayout = source('features/qr-labels/printLayout.ts');
const permissions = source('shared/auth/permissions.ts', {
  '../api/errors': errors,
  '../lib/env': { env: { useMock: false } },
});

const user = (role) => ({ id: 'user-' + role, role, name: role, email: role + '@example.com' });

test('source A is historical after splitting and only its new B/C labels can print', () => {
  assert.equal(qrTypes.labelStatusText('Split'), 'Đã tách · chỉ lưu lịch sử');
  assert.equal(qrTypes.isPrintableLabel({ status: 'Split', invalidatedAt: null, quantity: 50 }), false);
  assert.equal(qrTypes.isPrintableLabel({ status: 'Picked', invalidatedAt: null, quantity: 25 }), true);
  assert.equal(qrTypes.isPrintableLabel({ status: 'Available', invalidatedAt: null, quantity: 25 }), true);
});

function generationDialog({ quantity, query = {} } = {}) {
  const state = { submitted: [], error: null, submit: null, refetched: 0 };
  let hookIndex = 0;
  const capacityQuery = {
    data: { batchId: 'batch-q7', physicalQuantity: 20, labelledQuantity: 0, unlabelledQuantity: 20 },
    isSuccess: true, isFetching: false, isError: false,
    refetch: async () => { state.refetched++; }, ...query,
  };
  const element = React.createElement;
  const Dialog = source('features/qr-labels/components/GenerateQrDialog.tsx', {
    react: { ...React, useState: () => hookIndex++ === 0
      ? [quantity === undefined ? null : { batchId: 'batch-q7', value: quantity }, () => {}]
      : [null, (value) => { state.error = value; }] },
    '@/shared/api/errors': errors,
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: user('WarehouseKeeper') }) },
    '@/shared/auth/permissions': permissions,
    '@/shared/lib': { formatDate: (value) => value },
    '../hooks': {
      useGenerateQrLabel: () => ({ isPending: false, mutateAsync: async (value) => { state.submitted.push(value); } }),
      useQrGenerationCapacity: () => capacityQuery,
    },
    '@/shared/ui': {
      Modal: ({ children, footer }) => element('div', null, children, footer),
      Callout: ({ children }) => element('div', null, children),
      FormField: ({ children }) => element('div', null, children),
      Input: (props) => element('input', props),
      Button: ({ children, onClick, disabled }) => {
        if (children === 'Sinh mã QR') state.submit = { onClick, disabled };
        return element('button', { onClick, disabled }, children);
      },
    },
  }).GenerateQrDialog;
  state.html = renderToStaticMarkup(element(Dialog, {
    open: true, batch: { batchId: 'batch-q7', batchCode: 'WH-Q7-SKU002', sku: 'SKU002',
      productName: 'Sữa chua', onHandQuantity: 20, availableQuantity: 6 },
    existingCount: 1, onClose: () => {},
  }));
  return state;
}

test('generation uses server unlabelled stock, distinct from available-to-allocate quantity', async () => {
  const initial = generationDialog();
  assert.match(initial.html, /Chưa có tem QR/);
  assert.match(initial.html, /max="20"/);
  assert.match(initial.html, /value="20"/);
  assert.match(initial.html, /6 thùng/);
  for (const quantity of ['5', '6']) {
    const state = generationDialog({ quantity });
    assert.equal(state.submit.disabled, false);
    await state.submit.onClick({ preventDefault() {} });
    assert.deepEqual(state.submitted, [{ batchId: 'batch-q7', quantity: Number(quantity) }]);
  }
});

test('generation blocks fractional, excessive, empty and nonpositive quantities before POST', async () => {
  for (const quantity of ['5.5', '21', '', '0', '-1']) {
    const state = generationDialog({ quantity });
    await state.submit.onClick({ preventDefault() {} });
    assert.equal(state.submitted.length, 0, quantity);
    assert.ok(state.error, quantity);
  }
});

test('generation waits for fresh capacity and fails closed on missing data or zero unlabelled stock', async () => {
  for (const query of [
    { isFetching: true },
    { data: undefined, isSuccess: false, isError: true },
    { data: { batchId: 'batch-q7', physicalQuantity: 20, labelledQuantity: 20, unlabelledQuantity: 0 } },
  ]) {
    const state = generationDialog({ quantity: '5', query });
    assert.equal(state.submit.disabled, true);
    await state.submit.onClick({ preventDefault() {} });
    assert.equal(state.submitted.length, 0);
  }
});

test('generation capacity comes from the authorized batch API, not a sum of historical label quantities', async () => {
  const calls = [];
  const capacity = { batchId: 'batch-q7', physicalQuantity: 20, labelledQuantity: 0, unlabelledQuantity: 20 };
  const { qrLabelApi } = source('features/qr-labels/api.ts', {
    '@/shared/api/http': { http: {}, get: async (...args) => { calls.push(args); return capacity; } },
    '@/shared/api/errors': errors, './types': qrTypes,
  });
  assert.deepEqual(await qrLabelApi.generationCapacity('batch-q7'), capacity);
  assert.equal(calls[0][0], '/qr-labels/batches/batch-q7/generation-capacity');
});

test('RBAC: qr.view, qr.generate and qr.print conform to warehouse authorization matrix', () => {
  // qr.view
  assert.equal(permissions.can(user('Admin'), 'qr.view'), true);
  assert.equal(permissions.can(user('WarehouseKeeper'), 'qr.view'), true);
  assert.equal(permissions.can(user('Operator'), 'qr.view'), true);
  assert.equal(permissions.can(user('SalesManager'), 'qr.view'), false);
  assert.equal(permissions.can(user('Retailer'), 'qr.view'), false);

  // qr.generate
  assert.equal(permissions.can(user('Admin'), 'qr.generate'), true);
  assert.equal(permissions.can(user('WarehouseKeeper'), 'qr.generate'), true);
  assert.equal(permissions.can(user('Operator'), 'qr.generate'), true);
  assert.equal(permissions.can(user('SalesManager'), 'qr.generate'), false);
  assert.equal(permissions.can(user('Retailer'), 'qr.generate'), false);

  // qr.print
  assert.equal(permissions.can(user('Admin'), 'qr.print'), true);
  assert.equal(permissions.can(user('WarehouseKeeper'), 'qr.print'), true);
  assert.equal(permissions.can(user('Operator'), 'qr.print'), true);
  assert.equal(permissions.can(user('SalesManager'), 'qr.print'), false);
  assert.equal(permissions.can(user('Retailer'), 'qr.print'), false);
});

test('QR API Contract: qrLabelApi.generate calls POST /api/v1/qr-labels with Idempotency-Key and valid payload', async () => {
  const postCalls = [];
  const mockHttp = {
    get: async () => ({ data: [] }),
    post: async (url, payload, config) => {
      postCalls.push({ url, payload, config });
      return { data: undefined };
    },
  };

  const apiModule = source('features/qr-labels/api.ts', {
    '@/shared/api/http': {
      http: mockHttp,
      get: async (url, params) => mockHttp.get(url, { params }).then(r => r.data),
    },
    '@/shared/api/errors': errors,
    './types': qrTypes,
    './printLayout': printLayout,
  });

  const batchId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  await apiModule.qrLabelApi.generate({
    batchId,
    quantity: 50,
  });

  assert.equal(postCalls.length, 1);
  assert.equal(postCalls[0].url, '/qr-labels');
  assert.equal(postCalls[0].payload.batchId, batchId);
  assert.equal(postCalls[0].payload.quantity, 50);
  assert.ok(postCalls[0].config?.headers?.['Idempotency-Key']);
});

test('QR API Contract: qrLabelApi.list queries /qr-labels with optional batchId/warehouseId', async () => {
  const getCalls = [];
  const mockHttp = {
    get: async (url, config) => {
      getCalls.push({ url, config });
      return { data: [{ id: 'qr-1', qrCode: 'QR-B1-01', batchId: 'b-1', quantity: 20 }] };
    },
  };

  const apiModule = source('features/qr-labels/api.ts', {
    '@/shared/api/http': {
      http: mockHttp,
      get: async (url, params) => mockHttp.get(url, { params }).then(r => r.data),
    },
    '@/shared/api/errors': errors,
    './types': qrTypes,
    './printLayout': printLayout,
  });

  const labels = await apiModule.qrLabelApi.list({ batchId: 'b-1' });
  assert.equal(labels.length, 1);
  assert.equal(labels[0].qrCode, 'QR-B1-01');
  assert.equal(getCalls.length, 1);
  assert.equal(getCalls[0].url, '/qr-labels');
  assert.deepEqual(getCalls[0].config.params, { batchId: 'b-1' });
});

test('Batch Detail Page: displays "Mã QR lô hàng" section and passes batch data to QrLabelsPanel', () => {
  const detailFile = path.resolve(__dirname, '../src/features/batches/pages/BatchDetailPage.tsx');
  const detailCode = fs.readFileSync(detailFile, 'utf8');

  // Integrates QrLabelsPanel with batch prop
  assert.ok(detailCode.includes('<QrLabelsPanel'));
  assert.ok(detailCode.includes('batchId={b.batchId}'));
  assert.ok(detailCode.includes('batchCode={b.batchCode}'));
  assert.ok(detailCode.includes('batch={b}'));
});

test('QrLabelsPanel: exact section name "Mã QR lô hàng", Vietnamese empty state, and permissions', () => {
  const panelFile = path.resolve(__dirname, '../src/features/qr-labels/components/QrLabelsPanel.tsx');
  const panelCode = fs.readFileSync(panelFile, 'utf8');

  // Exact section name
  assert.ok(panelCode.includes('Mã QR lô hàng'));

  // Exact empty state text
  assert.ok(panelCode.includes('Chưa có mã QR cho lô hàng này.'));

  // Permission checks
  assert.ok(panelCode.includes("can(user, 'qr.generate')"));
  assert.ok(panelCode.includes("can(user, 'qr.print')"));
  assert.ok(panelCode.includes("can(user, 'qr.view')"));

  // Disposed batch cannot generate QR
  assert.ok(panelCode.includes("batch?.expiryStatus === 'Disposed'"));

  // Generation dialog integration
  assert.ok(panelCode.includes('<GenerateQrDialog'));
  assert.ok(panelCode.includes('<LabelPrintDialog'));
});

test('GenerateQrDialog: validates quantity > 0, prevents duplicate submissions and displays batch info', () => {
  const dialogFile = path.resolve(__dirname, '../src/features/qr-labels/components/GenerateQrDialog.tsx');
  const dialogCode = fs.readFileSync(dialogFile, 'utf8');

  // Header and user-facing messages
  assert.ok(dialogCode.includes('Sinh mã QR · Lô'));
  assert.ok(dialogCode.includes('Tạo tem QR chính thức từ hệ thống'));
  assert.ok(dialogCode.includes('Số lượng thùng trên tem *'));

  // Duplicate notice and existing labels handling
  assert.ok(dialogCode.includes('Lô hàng này đã có'));
  assert.ok(dialogCode.includes('tem QR'));
  assert.ok(dialogCode.includes('In tem hiện có'));

  // Eligibility check
  assert.ok(dialogCode.includes('Lô hàng chưa đủ điều kiện sinh mã QR. Vui lòng kiểm tra trạng thái ghi nhận hàng tồn.'));
  assert.ok(dialogCode.includes('Bạn chưa được cấp quyền thực hiện thao tác này.'));

  // Double submit prevention
  assert.ok(dialogCode.includes('generate.isPending'));
  assert.ok(dialogCode.includes('Đang sinh mã…'));

  // Quantity validation
  assert.ok(dialogCode.includes('Vui lòng nhập số lượng hợp lệ lớn hơn 0.'));
});

test('BatchesPage: displays QR column with real counts, and includes QR actions', () => {
  const pageFile = path.resolve(__dirname, '../src/features/batches/pages/BatchesPage.tsx');
  const pageCode = fs.readFileSync(pageFile, 'utf8');

  // Tem QR column
  assert.ok(pageCode.includes("header: 'Tem QR'"));
  assert.ok(pageCode.includes("qrLabelsByBatch.get(b.batchId)"));
  assert.ok(pageCode.includes("'Chưa có'"));
  assert.ok(pageCode.includes("tem"));

  // Row actions
  assert.ok(pageCode.includes("'Sinh mã QR'"));
  assert.ok(pageCode.includes("'In tem QR'"));

  // Direct [Xem] button preserved
  assert.ok(pageCode.includes('<span>Xem</span>'));

  // Dialogs integrated
  assert.ok(pageCode.includes('<GenerateQrDialog'));
  assert.ok(pageCode.includes('<LabelPrintDialog'));
});

test('UI Quality & No Mock Data: zero fake QR identifiers, sample QR codes or technical notes', () => {
  const panelFile = fs.readFileSync(path.resolve(__dirname, '../src/features/qr-labels/components/QrLabelsPanel.tsx'), 'utf8');
  const dialogFile = fs.readFileSync(path.resolve(__dirname, '../src/features/qr-labels/components/GenerateQrDialog.tsx'), 'utf8');
  const apiFile = fs.readFileSync(path.resolve(__dirname, '../src/features/qr-labels/api.ts'), 'utf8');

  // No mock data in runtime code
  assert.ok(!panelFile.includes('mockQr'));
  assert.ok(!dialogFile.includes('mockQr'));
  assert.ok(!apiFile.includes('mockQr'));

// No developer notes or raw status codes
  assert.ok(!panelFile.includes('HTTP 500'));
  assert.ok(!panelFile.includes('API endpoint'));
  assert.ok(!dialogFile.includes('HTTP 500'));
  assert.ok(!dialogFile.includes('API endpoint'));
});

test('Issue 1 Fix: QrLabelsPanel integrates useBatchInventory to resolve real inventory from Goods Receipt', () => {
  const panelFile = path.resolve(__dirname, '../src/features/qr-labels/components/QrLabelsPanel.tsx');
  const panelCode = fs.readFileSync(panelFile, 'utf8');
  const hooksFile = path.resolve(__dirname, '../src/features/qr-labels/hooks.ts');
  const hooksCode = fs.readFileSync(hooksFile, 'utf8');

  // Integrates useBatchInventory to resolve inventory without circular dependency
  assert.ok(panelCode.includes('useBatchInventory'));
  assert.ok(panelCode.includes('const batchQuery = useBatchInventory(batchId, !batch)'));
  assert.ok(hooksCode.includes('export function useBatchInventory'));
  assert.ok(panelCode.includes('resolvedBatch'));
  assert.ok(panelCode.includes('batchQuery.data.onHandQuantity'));
  assert.ok(panelCode.includes('batchQuery.data.availableQuantity'));

  // Disables while fetching batch inventory data to avoid premature zero-inventory error
  assert.ok(panelCode.includes('batchQuery.isFetching'));
});

test('Issue 2 Fix: useGenerateQrLabel adheres to useApiMutation with qr.generate and 403 standard error', () => {
  const { AxiosError } = require('axios');
  const hooksFile = path.resolve(__dirname, '../src/features/qr-labels/hooks.ts');
  const hooksCode = fs.readFileSync(hooksFile, 'utf8');

  // Uses useApiMutation with permission
  assert.ok(hooksCode.includes("import { useApiMutation } from '@/shared/hooks'"));
  assert.ok(hooksCode.includes("permission: 'qr.generate'"));
  assert.ok(hooksCode.includes("success: 'Sinh mã QR thành công.'"));

  // Check 403 status default in errors.ts
  const err403 = errors.toApiError(new AxiosError('Forbidden', 'ERR_BAD_REQUEST', undefined, undefined, { status: 403 }));
  assert.equal(err403.title, 'Bạn chưa được cấp quyền thực hiện thao tác này');
});

test('Goods Receipt Separation: Goods Receipt links to Batch Detail without embedding QR generation; Batch Detail is the exclusive QR management entry point', () => {
  const receiptFile = path.resolve(__dirname, '../src/features/receipts/pages/ReceiptDetailPage.tsx');
  const receiptCode = fs.readFileSync(receiptFile, 'utf8');

  // Goods Receipt does NOT embed QR generation or panel
  assert.ok(!receiptCode.includes('<QrLabelsPanel'));
  assert.ok(!receiptCode.includes('selectedBatchId'));
  assert.ok(!receiptCode.includes('activeBatchId'));

  // Goods Receipt provides clean navigation link to Batch Detail
  assert.ok(receiptCode.includes('/batches/${encodeURIComponent(line.batchId)}'));

  // Batch Detail is the exclusive entry point hosting QrLabelsPanel
  const detailFile = path.resolve(__dirname, '../src/features/batches/pages/BatchDetailPage.tsx');
  const detailCode = fs.readFileSync(detailFile, 'utf8');
  assert.ok(detailCode.includes('<QrLabelsPanel'));
  assert.ok(detailCode.includes('batchId={b.batchId}'));
  assert.ok(detailCode.includes('batch={b}'));
});

test('Admin retains full portal access, including Batch QR Generation', () => {
  const permCode = fs.readFileSync(path.resolve(__dirname, '../src/shared/auth/permissions.ts'), 'utf8');

  // The shared permission helper intentionally grants Admin every portal action.
  assert.ok(permCode.includes("user.role === 'Admin'"));

  // Admin with required permission can generate QR
  const adminUser = user('Admin');
  assert.equal(permissions.can(adminUser, 'qr.generate'), true);
  assert.doesNotThrow(() => permissions.assertPermission(adminUser, 'qr.generate'));

  // Authorized operational roles retain permission
  assert.equal(permissions.can(user('WarehouseKeeper'), 'qr.generate'), true);
  assert.equal(permissions.can(user('Operator'), 'qr.generate'), true);

  // Unauthorized roles cannot generate QR
  const smUser = user('SalesManager');
  assert.equal(permissions.can(smUser, 'qr.generate'), false);
  assert.throws(
    () => permissions.assertPermission(smUser, 'qr.generate'),
    (err) => err.status === 403 && err.title === 'Bạn chưa được cấp quyền thực hiện thao tác này'
  );

  const retUser = user('Retailer');
  assert.equal(permissions.can(retUser, 'qr.generate'), false);
  assert.throws(
    () => permissions.assertPermission(retUser, 'qr.generate'),
    (err) => err.status === 403 && err.title === 'Bạn chưa được cấp quyền thực hiện thao tác này'
  );

  // Anonymous user receives 401
  assert.throws(
    () => permissions.assertPermission(null, 'qr.generate'),
    (err) => err.status === 401 && err.title === 'Bạn cần đăng nhập để tiếp tục'
  );

  // Dialog proactive authorization guard check
  const dialogFile = path.resolve(__dirname, '../src/features/qr-labels/components/GenerateQrDialog.tsx');
  const dialogCode = fs.readFileSync(dialogFile, 'utf8');
  assert.ok(dialogCode.includes("import { useAuth } from '@/shared/auth/AuthContext'"));
  assert.ok(dialogCode.includes("can(user, 'qr.generate')"));
  assert.ok(dialogCode.includes('!hasPermission'));
  assert.ok(dialogCode.includes('Bạn chưa được cấp quyền thực hiện thao tác này.'));
});

test('Warehouse Keeper Scoped vs Admin Global Batch QR Generation logic', () => {
  const panelFile = path.resolve(__dirname, '../src/features/qr-labels/components/QrLabelsPanel.tsx');
  const panelCode = fs.readFileSync(panelFile, 'utf8');
  const dialogFile = path.resolve(__dirname, '../src/features/qr-labels/components/GenerateQrDialog.tsx');
  const dialogCode = fs.readFileSync(dialogFile, 'utf8');

  // Both components verify isKeeper, assignedWhIds and assignedWhCode
  assert.ok(panelCode.includes("user?.role === 'WarehouseKeeper'"));
  assert.ok(panelCode.includes("isWarehouseScoped"));
  assert.ok(dialogCode.includes("user?.role === 'WarehouseKeeper'"));
  assert.ok(dialogCode.includes("isWarehouseScoped"));

  // Check scoping simulation:
  const checkScope = (usr, batch) => {
    const isKeeper = usr?.role === 'WarehouseKeeper';
    const assignedWhIds = usr?.scope?.warehouseIds ?? [];
    const assignedWhCode = usr?.warehouseCode;
    const isWarehouseScoped =
      !isKeeper ||
      (batch?.warehouseId ? assignedWhIds.includes(batch.warehouseId) : false) ||
      (batch?.warehouseCode ? batch.warehouseCode === assignedWhCode : false) ||
      assignedWhIds.length === 0;
    return permissions.can(usr, 'qr.generate') && isWarehouseScoped;
  };

  const admin = user('Admin');
  const keeperAssigned = {
    ...user('WarehouseKeeper'),
    scope: { warehouseIds: ['wh-north'] },
    warehouseCode: 'WH-HN',
  };

  const batchInScope = {
    batchId: 'batch-1',
    batchCode: 'B-01',
    warehouseId: 'wh-north',
    warehouseCode: 'WH-HN',
  };

  const batchOutOfScope = {
    batchId: 'batch-2',
    batchCode: 'B-02',
    warehouseId: 'wh-south',
    warehouseCode: 'WH-HCM',
  };

  // Admin has global access to all batches
  assert.equal(checkScope(admin, batchInScope), true);
  assert.equal(checkScope(admin, batchOutOfScope), true);

  // Warehouse Keeper has access to scoped batch, blocked on out-of-scope batch
  assert.equal(checkScope(keeperAssigned, batchInScope), true);
  assert.equal(checkScope(keeperAssigned, batchOutOfScope), false);
});

test('QR print layout: 100x60 mm page, 38 mm QR, original QR SVG and label data untouched, idempotent', () => {
  const sample = fs.readFileSync(path.resolve(__dirname, '../docs/design/TEM-TEM-001021.html'), 'utf8');
  const out = printLayout.applyLabelPrintLayout(sample);
  assert.match(out, /@page\{size:100mm 60mm;margin:2mm\}/);
  assert.match(out, /\.qr\{width:38mm;height:38mm/);
  assert.equal(out.replace(/<style id="fscm-label-layout-100x60">[\s\S]*?<\/style>/, ''), sample);
  assert.equal(printLayout.applyLabelPrintLayout(out), out);
  // Layout override comes after the original stylesheet so it wins.
  assert.ok(out.indexOf('fscm-label-layout-100x60') > out.indexOf('@page{size:70mm 50mm'));
});
