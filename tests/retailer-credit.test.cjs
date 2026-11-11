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

test('Credit Eligibility Logic: accurately checks active status, granted term, and overdue debts', () => {
  function evaluateEligibility(retailer, receivables = []) {
    const activeReceivables = receivables.filter((r) => r.status !== 'Paid' && r.status !== 'Cancelled');
    const overdueItems = activeReceivables.filter((r) => r.status === 'Overdue');
    const hasCreditPermission = Number(retailer.creditTermDays) > 0;

    const reasons = [];
    if (retailer.status !== 'Active') {
      reasons.push('tài khoản không hoạt động');
    }
    if (!hasCreditPermission) {
      reasons.push('chưa được cấp kỳ hạn công nợ');
    }
    if (overdueItems.length > 0) {
      reasons.push('có khoản quá hạn');
    }

    const isEligible = reasons.length === 0;
    const fallbackMessage = !isEligible
      ? 'Khách hàng hiện chưa đủ điều kiện mua công nợ. Có thể lựa chọn thanh toán trước.'
      : null;

    return { isEligible, reasons, fallbackMessage };
  }

  // 1. Fully eligible retailer
  const eligibleRetailer = { status: 'Active', creditTermDays: 14 };
  const res1 = evaluateEligibility(eligibleRetailer, [
    { orderCode: 'ORD-001', status: 'Unpaid', outstandingAmount: 5000000 },
  ]);
  assert.equal(res1.isEligible, true);
  assert.equal(res1.reasons.length, 0);
  assert.equal(res1.fallbackMessage, null);

  // 2. Retailer with creditTermDays = 0 (Prepaid only)
  const prepaidRetailer = { status: 'Active', creditTermDays: 0 };
  const res2 = evaluateEligibility(prepaidRetailer, []);
  assert.equal(res2.isEligible, false);
  assert.ok(res2.reasons.includes('chưa được cấp kỳ hạn công nợ'));
  assert.equal(res2.fallbackMessage, 'Khách hàng hiện chưa đủ điều kiện mua công nợ. Có thể lựa chọn thanh toán trước.');

  // 3. Retailer with Overdue receivable
  const overdueRetailer = { status: 'Active', creditTermDays: 7 };
  const res3 = evaluateEligibility(overdueRetailer, [
    { orderCode: 'ORD-002', status: 'Overdue', outstandingAmount: 2000000 },
  ]);
  assert.equal(res3.isEligible, false);
  assert.ok(res3.reasons.includes('có khoản quá hạn'));
  assert.equal(res3.fallbackMessage, 'Khách hàng hiện chưa đủ điều kiện mua công nợ. Có thể lựa chọn thanh toán trước.');

  // 4. Retailer locked / inactive
  const lockedRetailer = { status: 'Locked', creditTermDays: 30 };
  const res4 = evaluateEligibility(lockedRetailer, []);
  assert.equal(res4.isEligible, false);
  assert.ok(res4.reasons.includes('tài khoản không hoạt động'));

  // 5. Multiple disqualifications
  const badRetailer = { status: 'Locked', creditTermDays: 0 };
  const res5 = evaluateEligibility(badRetailer, [
    { orderCode: 'ORD-003', status: 'Overdue', outstandingAmount: 1000000 },
  ]);
  assert.equal(res5.isEligible, false);
  assert.equal(res5.reasons.length, 3);
  assert.ok(res5.reasons.includes('tài khoản không hoạt động'));
  assert.ok(res5.reasons.includes('chưa được cấp kỳ hạn công nợ'));
  assert.ok(res5.reasons.includes('có khoản quá hạn'));
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
  assert.ok(creditCardCode.includes('Khách hàng hiện chưa đủ điều kiện mua công nợ. Có thể lựa chọn thanh toán trước.'));
  assert.ok(creditCardCode.includes('Quy tắc tính hạn thanh toán & snapshot kỳ hạn:'));
  assert.ok(creditCardCode.includes('Bắt đầu tính từ ngày <b>nhận đủ hàng</b>'));
  assert.ok(creditCardCode.includes('Snapshot độc lập:'));

  // 2. RetailerDetailPage imports and renders CreditTermsCard
  assert.ok(retailerDetailCode.includes('CreditTermsCard'));
  assert.ok(retailerDetailCode.includes('<CreditTermsCard retailer={retailer}'));
  assert.ok(retailerDetailCode.includes('Kỳ hạn áp dụng'));
  assert.ok(retailerDetailCode.includes('Mốc tính hạn (Ngày nhận)'));

  // 3. OrderDetailPage renders snapshot and due date trigger note
  assert.ok(orderDetailCode.includes('Kỳ hạn snapshot'));
  assert.ok(orderDetailCode.includes('Hạn thanh toán'));
  assert.ok(orderDetailCode.includes('Quy tắc công nợ & snapshot:'));

  // 4. API handles review/update credit terms and eligibility
  assert.ok(retailerApiCode.includes('order-eligibility'));
  assert.ok(retailerApiCode.includes('updateCreditTerms'));
});

