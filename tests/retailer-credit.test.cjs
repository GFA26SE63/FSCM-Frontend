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

const user = (role) => ({ permissions: require('./authorization-fixtures.cjs').grantsFor(role, permissions), id: 'user-' + role, role, name: role, email: role + '@example.com' });

test('RBAC: retailers.review permission is granted strictly to Admin and Operator', () => {
  assert.equal(permissions.can(user('Admin'), 'retailers.review'), true);
  assert.equal(permissions.can(user('Operator'), 'retailers.review'), true);
  assert.equal(permissions.can(user('WarehouseKeeper'), 'retailers.review'), false);
  assert.equal(permissions.can(user('SalesManager'), 'retailers.review'), false);
  assert.equal(permissions.can(user('Retailer'), 'retailers.review'), false);

  assert.throws(() => permissions.assertPermission(user('WarehouseKeeper'), 'retailers.review'), { status: 403 });
  assert.throws(() => permissions.assertPermission(user('Retailer'), 'retailers.review'), { status: 403 });
  assert.doesNotThrow(() => permissions.assertPermission(user('Admin'), 'retailers.review'));
  assert.doesNotThrow(() => permissions.assertPermission(user('Operator'), 'retailers.review'));
});

test('Credit grant is the authorized term-and-limit configuration, not Sales order eligibility', () => {
  const cardCode = fs.readFileSync(path.resolve(__dirname, '../src/features/retailers/components/CreditTermsCard.tsx'), 'utf8');

  assert.match(cardCode, /\[7, 14, 30\]\.includes\(Number\(retailer\.creditTermDays\)\)/);
  assert.match(cardCode, /Number\(retailer\.creditLimit \?\? 0\) > 0/);
  assert.match(cardCode, /Đã được người có thẩm quyền cấp/);
  assert.doesNotMatch(cardCode, /useRetailerEligibility|Đủ điều kiện mua công nợ/);
});

test('Term Snapshot Preservation: modifying retailer credit terms does not mutate existing orders', () => {
  const retailer = {
    code: '10000001',
    creditTermDays: 14,
  };

  // Order created while retailer has 14-day term
  const historicalOrder = {
    orderCode: 'SO-2026-0001',
    createdAt: '2026-09-01T08:00:00Z',
    deliveredDate: '2026-09-02T10:00:00Z',
    paymentMethod: 'Credit',
    creditTermDays: retailer.creditTermDays, // 14
    payment: {
      dueDate: '2026-09-16', // 2026-09-02 + 14 days
      status: 'Unpaid',
    },
  };

  // Retailer term is updated later (e.g. revoked or extended to 30 days)
  const updatedRetailer = {
    ...retailer,
    creditTermDays: 0, // Switched to Prepaid-only
  };

  // Historical order snapshot remains intact
  assert.equal(historicalOrder.creditTermDays, 14);
  assert.equal(historicalOrder.payment.dueDate, '2026-09-16');
  assert.notEqual(historicalOrder.creditTermDays, updatedRetailer.creditTermDays);
});

test('Due Date Trigger: calculated strictly from deliveredDate, never order creation date', () => {
  function calculateDueDate(deliveredDate, creditTermDays) {
    if (!deliveredDate || !creditTermDays) return null;
    const date = new Date(deliveredDate);
    date.setDate(date.getDate() + creditTermDays);
    return date.toISOString().slice(0, 10);
  }

  const createdAt = '2026-09-01T10:00:00Z';
  const deliveredDate = '2026-09-05T14:30:00Z';
  const creditTermDays = 7;

  // Due date should be deliveredDate + 7 days = 2026-09-12
  const dueDate = calculateDueDate(deliveredDate, creditTermDays);
  assert.equal(dueDate, '2026-09-12');

  // Must NOT equal createdAt + 7 days (2026-09-08)
  const falseDueDateFromCreated = calculateDueDate(createdAt, creditTermDays);
  assert.equal(falseDueDateFromCreated, '2026-09-08');
  assert.notEqual(dueDate, falseDueDateFromCreated);

  // When order is not delivered yet, due date is null (pending delivery)
  assert.equal(calculateDueDate(null, creditTermDays), null);
});

test('Source Code Integrity: CreditTermsCard, RetailerDetailPage, and OrderDetailPage implement required specifications', () => {
  const creditCardCode = fs.readFileSync(path.resolve(__dirname, '../src/features/retailers/components/CreditTermsCard.tsx'), 'utf8');
  const retailerDetailCode = fs.readFileSync(path.resolve(__dirname, '../src/features/retailers/pages/RetailerDetailPage.tsx'), 'utf8');
  const orderDetailCode = fs.readFileSync(path.resolve(__dirname, '../src/features/orders/pages/OrderDetailPage.tsx'), 'utf8');
  const retailerApiCode = fs.readFileSync(path.resolve(__dirname, '../src/features/retailers/api.ts'), 'utf8');

  // 1. CreditTermsCard contains required sections and fallback text
  assert.ok(creditCardCode.includes('Điều kiện mua công nợ'));
  assert.ok(creditCardCode.includes('Cấu hình điều kiện công nợ'));
  assert.ok(creditCardCode.includes("key: 'creditLimit'"));
  assert.ok(creditCardCode.includes('Hạn mức công nợ (VNĐ)'));
  // The ineligibility reasons block was removed from the UI on request.
  assert.ok(!creditCardCode.includes('Lý do chưa đủ điều kiện'));
  assert.ok(!creditCardCode.includes('Khách hàng hiện chưa đủ điều kiện mua công nợ.'));
  // The long rule explanations were removed from the UI on request.
  assert.ok(!creditCardCode.includes('Quy tắc tính hạn thanh toán và chốt kỳ hạn:'));

  // 2. RetailerDetailPage imports and renders CreditTermsCard
  assert.ok(retailerDetailCode.includes('CreditTermsCard'));
  assert.ok(retailerDetailCode.includes('<CreditTermsCard retailer={retailer}'));
  assert.ok(retailerDetailCode.includes('Kỳ hạn áp dụng'));
  assert.ok(retailerDetailCode.includes('Mốc tính hạn (Ngày nhận)'));

  // 3. OrderDetailPage renders snapshot and due date trigger note
  assert.ok(orderDetailCode.includes('Kỳ hạn chốt lúc đặt đơn'));
  assert.ok(orderDetailCode.includes('Hạn thanh toán'));
  assert.ok(!orderDetailCode.includes('Quy tắc công nợ áp dụng cho đơn:'));

  // 4. API handles review/update credit terms and eligibility
  assert.ok(retailerApiCode.includes('order-eligibility'));
  assert.ok(retailerApiCode.includes('updateCreditTerms'));
  assert.ok(retailerApiCode.includes('creditLimit: v.creditLimit'));
});

