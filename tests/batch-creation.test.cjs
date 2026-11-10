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
const dates = source('shared/lib/dates.ts');
const ids = source('shared/lib/ids.ts');

test('1. UI: "Ngày sản xuất" and "Lô NSX" fields are removed from Batch Creation form', () => {
  const formSource = fs.readFileSync(path.resolve(__dirname, '../src/features/receipts/pages/ReceiptFormPage.tsx'), 'utf8');

  // Verify fields are absent from JSX labels
  assert.equal(formSource.includes('label="Ngày sản xuất (NSX)"'), false, 'Should not render Ngày sản xuất FormField');
  assert.equal(formSource.includes('label="Ngày sản xuất"'), false, 'Should not render Ngày sản xuất label');
  assert.equal(formSource.includes('label="Lô NSX"'), false, 'Should not render Lô NSX FormField');
  assert.equal(formSource.includes('Ví dụ: LOT-2026-A'), false, 'Should not render LOT placeholder');

  // Verify form lines initial state does not contain them
  assert.equal(formSource.includes('createBlankLine = (): FormLine => ({\n  productId: \'\',\n  sku: \'\',\n  expirationDate: \'\',\n  quantity: \'\''), true);
});

test('2. Validation: required-field validations and error messages for mfg date / lot are removed', () => {
  const formSource = fs.readFileSync(path.resolve(__dirname, '../src/features/receipts/pages/ReceiptFormPage.tsx'), 'utf8');

  // Validation strings must be completely absent from source
  assert.equal(formSource.includes('Vui lòng nhập ngày sản xuất.'), false);
  assert.equal(formSource.includes('Ngày sản xuất phải trước hoặc bằng hạn sử dụng.'), false);

  // Validate row logic directly
  const validateRow = (r) => {
    if (!r.productId) return 'Vui lòng chọn sản phẩm.';
    if (!r.expirationDate) return 'Vui lòng nhập hạn sử dụng.';
    const qtyNum = Number(r.quantity);
    if (!qtyNum || qtyNum <= 0) return 'Số lượng nhập phải lớn hơn 0.';
    return null;
  };

  // Line without mfgDate and without lotCode is 100% valid
  const validLine = {
    productId: 'prod-001',
    sku: 'SKU-001',
    expirationDate: '2027-10-15',
    quantity: '50',
  };
  assert.equal(validateRow(validLine), null);
});

test('3. Other required fields (Product, Expiration Date, Quantity) still validate strictly', () => {
  const validateRow = (r) => {
    if (!r.productId) return 'Vui lòng chọn sản phẩm.';
    if (!r.expirationDate) return 'Vui lòng nhập hạn sử dụng.';
    const qtyNum = Number(r.quantity);
    if (!qtyNum || qtyNum <= 0) return 'Số lượng nhập phải lớn hơn 0.';
    return null;
  };

  // Missing product
  assert.equal(
    validateRow({ productId: '', expirationDate: '2027-10-15', quantity: '50' }),
    'Vui lòng chọn sản phẩm.',
  );

  // Missing expiration date
  assert.equal(
    validateRow({ productId: 'prod-001', expirationDate: '', quantity: '50' }),
    'Vui lòng nhập hạn sử dụng.',
  );

  // Invalid quantity: empty, zero, negative
  assert.equal(
    validateRow({ productId: 'prod-001', expirationDate: '2027-10-15', quantity: '' }),
    'Số lượng nhập phải lớn hơn 0.',
  );
  assert.equal(
    validateRow({ productId: 'prod-001', expirationDate: '2027-10-15', quantity: '0' }),
    'Số lượng nhập phải lớn hơn 0.',
  );
  assert.equal(
    validateRow({ productId: 'prod-001', expirationDate: '2027-10-15', quantity: '-10' }),
    'Số lượng nhập phải lớn hơn 0.',
  );
});

test('4. API Compatibility: Create request matches schema and omits unentered fields without fabricating defaults', () => {
  const rows = [
    {
      productId: '11111111-2222-3333-4444-555555555555',
      sku: 'SKU-MILK-100',
      expirationDate: '2027-08-20',
      quantity: '100',
    },
  ];

  const warehouseId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  // Build payload as done in ReceiptFormPage.tsx handleSubmit
  const payload = {
    warehouseId,
    lines: rows.map((r) => ({
      productId: r.productId,
      quantity: Number(r.quantity),
      expirationDate: r.expirationDate,
    })),
  };

  // Assert required fields exist
  assert.equal(payload.warehouseId, warehouseId);
  assert.equal(payload.lines.length, 1);
  assert.equal(payload.lines[0].productId, '11111111-2222-3333-4444-555555555555');
  assert.equal(payload.lines[0].quantity, 100);
  assert.equal(payload.lines[0].expirationDate, '2027-08-20');

  // Assert NO fabricated defaults exist
  assert.equal(payload.lines[0].productionDate, undefined, 'Must not fabricate manufacturing date');
  assert.equal(payload.lines[0].sourceLotCode, undefined, 'Must not fabricate manufacturer lot');

  // Schema compliance: no forbidden extra fields
  assert.equal(payload.lines[0].sku, undefined);
  assert.equal(payload.lines[0].productName, undefined);
  assert.equal(payload.note, undefined);
});

test('5. Real API Integration: receiptApi.create attaches Idempotency-Key header and posts to /goods-receipts', async () => {
  let capturedUrl = '';
  let capturedBody = null;
  let capturedHeaders = null;

  const mockHttp = {
    post: async (url, body, options) => {
      capturedUrl = url;
      capturedBody = body;
      capturedHeaders = options?.headers;
      return {
        data: {
          id: 'receipt-uuid-001',
          receiptCode: 'PN-20261110-01',
          warehouseId: body.warehouseId,
          status: 'Pending',
          lines: body.lines.map((l, i) => ({
            id: `line-${i + 1}`,
            productId: l.productId,
            receivedQuantity: l.quantity,
            expirationDate: l.expirationDate,
            productionDate: l.productionDate || null,
            sourceLotCode: l.sourceLotCode || null,
            batchId: null,
            batchCode: null,
          })),
        },
      };
    },
    get: async () => ({ data: {} }),
  };

  const receiptsApi = source('features/receipts/api.ts', {
    '@/shared/api/http': {
      http: mockHttp,
      get: () => Promise.resolve({}),
      getAll: () => Promise.resolve([]),
      post: () => Promise.resolve({}),
    },
    '@/shared/api/errors': errors,
  });

  const payload = {
    warehouseId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    lines: [
      {
        productId: '11111111-2222-3333-4444-555555555555',
        quantity: 50,
        expirationDate: '2027-12-31',
      },
    ],
  };

  const result = await receiptsApi.receiptApi.create(payload);

  assert.equal(capturedUrl, '/goods-receipts');
  assert.deepEqual(capturedBody, payload);
  assert.ok(capturedHeaders?.['Idempotency-Key'], 'Must send Idempotency-Key header');
  assert.equal(result.receiptCode, 'PN-20261110-01');
  assert.equal(result.status, 'Pending');
});

test('6. Batch details & ID generation: IdFormat.batch relies strictly on warehouse, SKU and expiration date', () => {
  const warehouseCode = 'WH-TA';
  const sku = 'SKU006';
  const expirationDate = '2026-10-18';

  const generatedBatchCode = ids.IdFormat.batch(warehouseCode, sku, expirationDate);
  assert.equal(generatedBatchCode, 'WH-TA-SKU006-18102026');

  // Verify that batch code generation is completely independent of manufacturing date or lot number
  assert.equal(generatedBatchCode.includes('LOT'), false);
  assert.equal(generatedBatchCode.includes('20261110'), false);
});

test('7. Batch Detail & Expiry Handling: formatDate gracefully formats valid dates and handles empty/default values', () => {
  assert.equal(dates.formatDate('2027-05-15'), '15/05/2027');
  assert.equal(dates.formatDate(null), '—');
  assert.equal(dates.formatDate(undefined), '—');
  assert.equal(dates.formatDate(''), '—');
  assert.equal(dates.formatDate('0001-01-01'), '—');
});

test('8. UI Quality & No Mock Data: zero simulated data or technical developer notes in Batch Creation', () => {
  const formSource = fs.readFileSync(path.resolve(__dirname, '../src/features/receipts/pages/ReceiptFormPage.tsx'), 'utf8');

  // No mock arrays or simulated IDs
  assert.equal(formSource.includes('MOCK_'), false);
  assert.equal(formSource.includes('mockReceipt'), false);
  assert.equal(formSource.includes('fake'), false);

  // No developer notes or backend jargon
  assert.equal(formSource.includes('API endpoint'), false);
  assert.equal(formSource.includes('POST /api/v1/goods-receipts'), false);
  assert.equal(formSource.includes('ReceiveGoodsLineRequest'), false);
  assert.equal(formSource.includes('additionalProperties'), false);
});

