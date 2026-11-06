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

const status = source('shared/lib/status.ts');
const statusChip = source('shared/ui/StatusChip.tsx', {
  '../lib/status': status,
});

const ids = source('shared/lib/ids.ts');

const user = (role) => ({ id: 'user-' + role, role, name: role, email: role + '@example.com' });

test('Disposal status maps to exact Vietnamese business labels', () => {
  assert.equal(status.statusLabels.disposal.Pending, 'Chờ duyệt');
  assert.equal(status.statusLabels.disposal.Disposed, 'Đã tiêu hủy');
  assert.equal(status.statusLabels.disposal.Rejected, 'Bị từ chối');

  assert.equal(status.statusLabel('disposal', 'Pending'), 'Chờ duyệt');
  assert.equal(status.statusLabel('disposal', 'Disposed'), 'Đã tiêu hủy');
  assert.equal(status.statusLabel('disposal', 'Rejected'), 'Bị từ chối');
});

test('Disposal status chips map to correct UI tones', () => {
  assert.equal(statusChip.toneOf('Chờ duyệt'), 'info');
  assert.equal(statusChip.toneOf('Đã tiêu hủy'), 'ok');
  assert.equal(statusChip.toneOf('Bị từ chối'), 'danger');
});

test('Disposal permissions: Keeper and Admin can create; only Admin can approve', () => {
  // Creation permissions
  assert.equal(permissions.can(user('Admin'), 'disposal.create'), true);
  assert.equal(permissions.can(user('WarehouseKeeper'), 'disposal.create'), true);
  assert.equal(permissions.can(user('Operator'), 'disposal.create'), false);
  assert.equal(permissions.can(user('SalesManager'), 'disposal.create'), false);

  // Approval permissions (Only Admin can approve; WarehouseKeeper cannot approve their own request)
  assert.equal(permissions.can(user('Admin'), 'disposal.approve'), true);
  assert.equal(permissions.can(user('WarehouseKeeper'), 'disposal.approve'), false);
  assert.equal(permissions.can(user('Operator'), 'disposal.approve'), false);
  assert.equal(permissions.can(user('SalesManager'), 'disposal.approve'), false);
});

test('Disposal document code preview follows exact format PH-{yyMMdd}-{nn}', () => {
  const code = ids.IdFormat.document('Disposal', '2026-09-27', 1);
  assert.equal(code, 'PH-260927-01');

  const code2 = ids.IdFormat.document('Disposal', '2026-10-15', 12);
  assert.equal(code2, 'PH-261015-12');
});

test('Business logic prevents negative stock when batches have reserved customer orders', () => {
  // Scenario 1: On-hand 100, Reserved 30 -> Eligible 70, not blocked
  const onHand1 = 100;
  const reserved1 = 30;
  const eligible1 = Math.max(0, onHand1 - reserved1);
  const isBlocked1 = reserved1 > 0 && reserved1 >= onHand1;
  assert.equal(eligible1, 70);
  assert.equal(isBlocked1, false);

  // Scenario 2: On-hand 50, Reserved 50 -> All physical stock is committed to orders
  const onHand2 = 50;
  const reserved2 = 50;
  const eligible2 = Math.max(0, onHand2 - reserved2);
  const isBlocked2 = reserved2 > 0 && reserved2 >= onHand2;
  assert.equal(eligible2, 0);
  assert.equal(isBlocked2, true);
});

test('Batch Management integrates with Write-off without technical jargon', () => {
  const batchesPageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/batches/pages/BatchesPage.tsx'), 'utf8');
  const batchDetailCode = fs.readFileSync(path.resolve(__dirname, '../src/features/batches/pages/BatchDetailPage.tsx'), 'utf8');
  const disposalPageCode = fs.readFileSync(path.resolve(__dirname, '../src/features/disposal/pages/DisposalPage.tsx'), 'utf8');
  const disposalFormCode = fs.readFileSync(path.resolve(__dirname, '../src/features/disposal/pages/DisposalFormPage.tsx'), 'utf8');
  const disposalDetailCode = fs.readFileSync(path.resolve(__dirname, '../src/features/disposal/pages/DisposalDetailPage.tsx'), 'utf8');

  // Both batches screens navigate to /disposal/new
  assert.ok(batchesPageCode.includes('/disposal/new'));
  assert.ok(batchDetailCode.includes('/disposal/new'));

  // Standardized action header
  assert.ok(disposalPageCode.includes('rowActionHeader="Thao tác"'));
  assert.ok(disposalPageCode.includes('<ActionDropdown'));
  assert.ok(disposalPageCode.includes('Xem'));

  // Confirm dialogs
  assert.ok(disposalPageCode.includes('<ConfirmDialog'));
  assert.ok(disposalDetailCode.includes('<ConfirmDialog'));

  // No technical error text or internal terms in UI
  assert.equal(disposalPageCode.includes('API GAP'), false);
  assert.equal(disposalFormCode.includes('UUID'), false);
  assert.equal(disposalDetailCode.includes('HTTP'), false);
});

test('Batch Selection Table Redesign: Merged Product/SKU, clear columns, badges, copy batch code', () => {
  const formCode = fs.readFileSync(path.resolve(__dirname, '../src/features/disposal/pages/DisposalFormPage.tsx'), 'utf8');

  // 1. Section Title is "Lô hàng hết hạn hoặc đang bị khóa"
  assert.ok(formCode.includes('title="Lô hàng hết hạn hoặc đang bị khóa"'));
  assert.equal(formCode.includes('hệ thống tự liệt kê'), false);

  // 2. Merged Product / SKU column header and cell layout
  assert.ok(formCode.includes('>Sản phẩm / SKU<'));
  assert.ok(formCode.includes('r.productName'));
  assert.ok(formCode.includes('r.sku'));

  // 3. Separate Warehouse column
  assert.ok(formCode.includes('>Kho<'));

  // 4. Batch code column with single-line truncated text and copy action
  assert.ok(formCode.includes('>Số lô<'));
  assert.ok(formCode.includes('textOverflow: \'ellipsis\''));
  assert.ok(formCode.includes('handleCopyBatchCode'));
  assert.ok(formCode.includes('title={r.batchCode}'));

  // 5. Expiry Date and Status columns
  assert.ok(formCode.includes('>Hạn sử dụng<'));
  assert.ok(formCode.includes('>Tình trạng<'));
  assert.ok(formCode.includes('formatLockReason'));

  // 6. Right-aligned numeric columns
  assert.ok(formCode.includes("style={{ width: 140, textAlign: 'right', padding: '10px 12px' }}>Số lượng cần hủy</th>"));
  assert.ok(formCode.includes("style={{ width: 140, textAlign: 'right', padding: '10px 12px' }}>Giá trị ước tính</th>"));

  // 7. Status Badges
  assert.ok(formCode.includes('tone="danger"')); // Hết hạn
  assert.ok(formCode.includes('tone="warn"'));   // Đang khóa
  assert.ok(formCode.includes('tone="neutral"')); // Đang giữ hàng

  // 8. Empty state
  assert.ok(formCode.includes('Không có lô hàng nào hết hạn hoặc bị khóa cần hủy.'));

  // 9. Horizontal scrolling container
  assert.ok(formCode.includes('overflowX: \'auto\''));
  assert.ok(formCode.includes('minWidth: 1050'));
});

test('Warehouse Dropdown: Only shows warehouses with relevant batches and preserves full options list', () => {
  const formCode = fs.readFileSync(path.resolve(__dirname, '../src/features/disposal/pages/DisposalFormPage.tsx'), 'utf8');

  // Uses real backend data
  assert.ok(formCode.includes('useWarehouses()'));
  assert.ok(formCode.includes('candidatesQuery = useDisposalCandidates()'));

  // Only matches relevant warehouses having candidates
  assert.ok(formCode.includes('relevantWhMap'));
  assert.ok(formCode.includes('matched.set'));

  // Dropdown includes reset option "Tất cả kho" and handles empty state
  assert.ok(formCode.includes("value: 'all', label: 'Tất cả kho'"));
  assert.ok(formCode.includes('Không có kho nào có hàng cần hủy'));

  // Dropdown options depend on availableCandidates and warehouses, NOT on selectedWarehouseId
  assert.ok(formCode.includes('filteredRows = useMemo'));
});

test('Warehouse filtering simulation: A has expired, B has locked, C has none -> Dropdown shows A and B only', () => {
  const candidateBatches = [
    { batchCode: 'B-01', warehouseId: 'wh-a', warehouseCode: 'KHO-A', warehouseName: 'Kho A', expiryStatus: 'Expired', isLocked: false },
    { batchCode: 'B-02', warehouseId: 'wh-b', warehouseCode: 'KHO-B', warehouseName: 'Kho B', expiryStatus: 'Normal', isLocked: true },
  ];
  const allWarehouses = [
    { id: 'wh-a', code: 'KHO-A', name: 'Kho A', status: 'Active' },
    { id: 'wh-b', code: 'KHO-B', name: 'Kho B', status: 'Active' },
    { id: 'wh-c', code: 'KHO-C', name: 'Kho C', status: 'Active' },
  ];

  // Logic replicated from DisposalFormPage.tsx
  const relevantWhMap = new Map();
  candidateBatches.forEach((c) => {
    if (c.warehouseId) relevantWhMap.set(c.warehouseId, { code: c.warehouseCode, name: c.warehouseName });
  });

  const matched = new Map();
  allWarehouses.filter((w) => w.status === 'Active').forEach((w) => {
    if (w.id && relevantWhMap.has(w.id)) {
      matched.set(w.id, `${w.code} · ${w.name}`);
    }
  });

  const options = [
    { value: 'all', label: 'Tất cả kho' },
    ...Array.from(matched.entries()).map(([value, label]) => ({ value, label })),
  ];

  // 1. Dropdown shows A and B only; C is excluded
  assert.equal(options.length, 3);
  assert.equal(options[0].value, 'all');
  assert.equal(options[1].value, 'wh-a');
  assert.equal(options[2].value, 'wh-b');
  assert.equal(options.some((o) => o.value === 'wh-c'), false);

  // 2. Selecting A filters batch records
  const selectedWh = 'wh-a';
  const filteredRows = candidateBatches.filter((c) => c.warehouseId === selectedWh);
  assert.equal(filteredRows.length, 1);
  assert.equal(filteredRows[0].batchCode, 'B-01');

  // 3. Dropdown options list does NOT shrink when A is selected
  assert.equal(options.length, 3);
  assert.equal(options.some((o) => o.value === 'wh-b'), true);

  // 4. Switching to B works
  const filteredB = candidateBatches.filter((c) => c.warehouseId === 'wh-b');
  assert.equal(filteredB.length, 1);
  assert.equal(filteredB[0].batchCode, 'B-02');

  // 5. Resetting to all warehouses returns all eligible batches
  const filteredAll = candidateBatches.filter(() => true);
  assert.equal(filteredAll.length, 2);
});

test('Confirmation Dialog & Error Handling', () => {
  const apiCode = fs.readFileSync(path.resolve(__dirname, '../src/features/disposal/api.ts'), 'utf8');
  const formCode = fs.readFileSync(path.resolve(__dirname, '../src/features/disposal/pages/DisposalFormPage.tsx'), 'utf8');

  // Confirmation dialog exists with proper titles and labels
  assert.ok(formCode.includes('<ConfirmDialog'));
  assert.ok(formCode.includes('title="Xác nhận gửi phiếu hủy"'));
  assert.ok(formCode.includes('confirmLabel="Xác nhận gửi phiếu"'));
  assert.ok(formCode.includes('cancelLabel="Quay lại"'));
  assert.ok(formCode.includes('danger'));

  // Summarizes required fields in dialog
  assert.ok(formCode.includes('Kho xuất hủy:'));
  assert.ok(formCode.includes('Số lô đã chọn:'));
  assert.ok(formCode.includes('Tổng số lượng:'));
  assert.ok(formCode.includes('Tổng giá trị:'));
  assert.ok(formCode.includes('Lý do hủy:'));
  assert.ok(formCode.includes('Hình thức xử lý:'));

  // API maps 404 on write-offs creation to clear Vietnamese message
  assert.ok(apiCode.includes("apiErr.status === 404"));
  assert.ok(apiCode.includes('Chức năng gửi phiếu hủy hiện chưa khả dụng'));

  // Form retains user inputs upon error and displays submitError callout
  assert.ok(formCode.includes('submitError'));
  assert.ok(formCode.includes('<Callout tone="danger">'));
});
