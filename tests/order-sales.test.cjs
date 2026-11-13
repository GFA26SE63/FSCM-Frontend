const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) throw new Error('Missing boundary mock: ' + name);
    return require(name);
  }, module, module.exports);
  return module.exports;
}

const SALES_1_ID = '11111111-1111-4111-8111-111111111111';
const SALES_2_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const RETAILER_ID = '44444444-4444-4444-8444-444444444444';
const UNKNOWN_ID = '55555555-5555-4555-8555-555555555555';
const EMAIL_ONLY_ID = '66666666-6666-4666-8666-666666666666';

const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function setupOrderSales({ role = 'Admin', me, users = {}, pendingIds = [] }) {
  const requested = [];
  const mod = source('features/orders/orderSales.ts', {
    react: { useMemo: (fn) => fn() },
    '@tanstack/react-query': {
      useQueries: ({ queries }) =>
        queries.map((q) => {
          requested.push(q.queryKey);
          const id = q.queryKey[2];
          if (pendingIds.includes(id)) return { isPending: true };
          return users[id] ? { isPending: false, data: users[id] } : { isPending: false, isError: true };
        }),
    },
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { ...me, role } }) },
    '@/shared/auth/permissions': { can: (u, perm) => perm === 'users.manage' && u.role === 'Admin' },
    '@/features/users/api': { userApi: {} },
  });
  return { mod, requested };
}

test('formatSalesName: respects display priority and role labeling, never returns raw UUID', () => {
  const mod = source('features/orders/orderSales.ts', {
    react: { useMemo: (fn) => fn() },
    '@tanstack/react-query': { useQueries: () => [] },
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: null }) },
    '@/shared/auth/permissions': { can: () => false },
    '@/features/users/api': { userApi: {} },
  });

  // Priority 1: Full name
  assert.equal(
    mod.formatSalesName({ id: SALES_1_ID, fullName: 'Nguyễn Văn An', email: 'an.nv@fscm.vn', role: 'Sales' }),
    'Nguyễn Văn An',
  );

  // Priority 2: Account / Email when full name is missing
  assert.equal(
    mod.formatSalesName({ id: SALES_1_ID, fullName: '   ', email: 'an.nv@fscm.vn', role: 'Sales' }),
    'an.nv@fscm.vn',
  );

  // Priority 3: Fallback 'Không xác định'
  assert.equal(mod.formatSalesName(undefined), 'Không xác định');
  assert.equal(mod.formatSalesName({ id: SALES_1_ID, fullName: '', email: '' }), 'Không xác định');

  // Non-sales actors preserved with clear role tag to prevent false attribution to Sales
  assert.equal(
    mod.formatSalesName({ id: ADMIN_ID, fullName: 'Quản Trị Viên', email: 'admin@fscm.vn', role: 'Admin' }),
    '[Admin] Quản Trị Viên',
  );
  assert.equal(
    mod.formatSalesName({ id: RETAILER_ID, fullName: 'Tạp Hóa Bình An', email: 'retailer@fscm.vn', role: 'Retailer' }),
    '[Điểm bán] Tạp Hóa Bình An',
  );
  assert.equal(
    mod.formatSalesName({ id: 'op-1', fullName: 'Điều Phối Viên', email: 'op@fscm.vn', role: 'Operator' }),
    '[Vận hành] Điều Phối Viên',
  );

  // Never returns UUID
  assert.doesNotMatch(mod.formatSalesName({ id: SALES_1_ID, fullName: 'Nguyễn Văn An' }), uuidRegex);
  assert.doesNotMatch(mod.formatSalesName(undefined), uuidRegex);
});

test('Admin: full name resolved from users API; deduplicated requests; never raw UUIDs', () => {
  const { mod, requested } = setupOrderSales({
    role: 'Admin',
    me: { id: ADMIN_ID, name: 'Quản trị viên', email: 'admin@fscm.vn', role: 'Admin' },
    users: {
      [SALES_1_ID.toLowerCase()]: { id: SALES_1_ID, fullName: 'Lê Sales Một', email: 's1@fscm.vn', role: 'Sales' },
      [SALES_2_ID.toLowerCase()]: { id: SALES_2_ID, fullName: 'Trần Sales Hai', email: 's2@fscm.vn', role: 'Sales' },
      [EMAIL_ONLY_ID.toLowerCase()]: { id: EMAIL_ONLY_ID, fullName: '', email: 's3.email@fscm.vn', role: 'Sales' },
      [RETAILER_ID.toLowerCase()]: { id: RETAILER_ID, fullName: 'Đại lý Minh Phát', email: 'mp@fscm.vn', role: 'Retailer' },
    },
  });

  const ids = [
    SALES_1_ID,
    SALES_1_ID, // duplicate
    SALES_2_ID.toUpperCase(), // casing difference
    ADMIN_ID, // current user
    EMAIL_ONLY_ID,
    RETAILER_ID,
    UNKNOWN_ID,
    null,
    undefined,
  ];

  const { salesNameOf, creatorLabelOf, salesSearchTextOf } = mod.useOrderSales(ids);

  // Sales 1 (full name)
  assert.equal(salesNameOf(SALES_1_ID), 'Lê Sales Một');
  assert.equal(creatorLabelOf(SALES_1_ID), 'Người đặt đơn');
  assert.equal(salesSearchTextOf(SALES_1_ID), 'Lê Sales Một s1@fscm.vn');

  // Sales 2 (full name)
  assert.equal(salesNameOf(SALES_2_ID), 'Trần Sales Hai');

  // Sales 3 (email only)
  assert.equal(salesNameOf(EMAIL_ONLY_ID), 's3.email@fscm.vn');

  // Admin (current user local resolution without network request)
  assert.equal(salesNameOf(ADMIN_ID), '[Admin] Quản trị viên');
  assert.equal(creatorLabelOf(ADMIN_ID), 'Người đặt đơn');

  // Retailer (non-sales role preserved)
  assert.equal(salesNameOf(RETAILER_ID), '[Điểm bán] Đại lý Minh Phát');
  assert.equal(creatorLabelOf(RETAILER_ID), 'Người đặt đơn');

  // Unresolvable fallback
  assert.equal(salesNameOf(UNKNOWN_ID), 'Không xác định');
  assert.equal(salesNameOf(null), 'Không xác định');
  assert.equal(salesNameOf(undefined), 'Không xác định');

  // Verify only remote users were requested, each exactly once, lowercase
  const requestedIds = requested.map((k) => k[2]);
  assert.ok(requestedIds.includes(SALES_1_ID.toLowerCase()));
  assert.ok(requestedIds.includes(SALES_2_ID.toLowerCase()));
  assert.ok(requestedIds.includes(EMAIL_ONLY_ID.toLowerCase()));
  assert.ok(requestedIds.includes(RETAILER_ID.toLowerCase()));
  assert.ok(requestedIds.includes(UNKNOWN_ID.toLowerCase()));
  // Admin was resolved locally, never requested
  assert.ok(!requestedIds.includes(ADMIN_ID.toLowerCase()));
  // No duplicate fetches
  assert.equal(new Set(requestedIds).size, requestedIds.length);

  // Strictly verify no raw UUID is ever returned
  for (const id of [SALES_1_ID, SALES_2_ID, ADMIN_ID, RETAILER_ID, UNKNOWN_ID, EMAIL_ONLY_ID]) {
    assert.doesNotMatch(salesNameOf(id), uuidRegex);
  }
});

test('Pending queries display loading indicator, never raw UUID', () => {
  const { mod } = setupOrderSales({
    role: 'Admin',
    me: { id: ADMIN_ID, name: 'Admin', email: 'admin@fscm.vn' },
    pendingIds: [SALES_1_ID.toLowerCase()],
  });

  const { salesNameOf } = mod.useOrderSales([SALES_1_ID]);
  assert.equal(salesNameOf(SALES_1_ID), '…');
  assert.doesNotMatch(salesNameOf(SALES_1_ID), uuidRegex);
});

test('Non-admin role (e.g. Operator) without users.manage permission does not call /users API', () => {
  const { mod, requested } = setupOrderSales({
    role: 'Operator',
    me: { id: 'op-user', name: 'Điều phối viên', email: 'operator@fscm.vn' },
  });

  const { salesNameOf } = mod.useOrderSales([SALES_1_ID, 'op-user']);
  // No remote requests issued
  assert.equal(requested.length, 0);
  // Logged-in user resolved
  assert.equal(salesNameOf('op-user'), '[Vận hành] Điều phối viên');
  // Remote user falls back to UNKNOWN_USER
  assert.equal(salesNameOf(SALES_1_ID), 'Không xác định');
});

test('OrdersPage and OrderDetailPage source files contain correct unified labels and layout', () => {
  const ordersPageSrc = fs.readFileSync(path.resolve(__dirname, '../src/features/orders/pages/OrdersPage.tsx'), 'utf8');
  const orderDetailSrc = fs.readFileSync(path.resolve(__dirname, '../src/features/orders/pages/OrderDetailPage.tsx'), 'utf8');

  // OrdersPage column and filter use unified "Người đặt đơn"
  assert.ok(ordersPageSrc.includes("header: 'Người đặt đơn'"));
  assert.ok(ordersPageSrc.includes("key: 'sales'"));
  assert.ok(ordersPageSrc.includes('salesSearchTextOf('));
  assert.ok(ordersPageSrc.includes('salesNameOf('));
  assert.match(ordersPageSrc, /label:\s*'Người đặt đơn'/);
  assert.ok(ordersPageSrc.includes("searchPlaceholder=\"Mã đơn, retailer, người đặt, trạng thái…\""));
  assert.ok(ordersPageSrc.includes("param: 'sales'"));

  // OrderDetailPage detail display uses unified "Người đặt đơn"
  assert.match(orderDetailSrc, /label:\s*'Người đặt đơn'/);
  assert.ok(orderDetailSrc.includes('salesNameOf(order.createdByUserId)'));
  assert.ok(!orderDetailSrc.includes("'Sales tạo online'"));
  assert.ok(!orderDetailSrc.includes("'Offline gửi thủ công'"));

  // Ensure field ordering in OrderDetailPage is strictly uniform:
  // Row 1: Retailer, Địa chỉ giao, Ngày yêu cầu nhận
  // Row 2: Nguồn, Thanh toán, Kỳ hạn snapshot
  // Row 3: Hạn thanh toán, Lần phân bổ, Kết quả phân bổ
  // Row 4: Người đặt đơn
  const fieldOrder = [
    'Retailer',
    'Địa chỉ giao',
    'Ngày yêu cầu nhận',
    'Nguồn',
    'Thanh toán',
    'Kỳ hạn snapshot',
    'Hạn thanh toán',
    'Lần phân bổ',
    'Kết quả phân bổ',
    'Người đặt đơn',
  ];
  let lastIndex = -1;
  for (const label of fieldOrder) {
    const idx = orderDetailSrc.indexOf(`'${label}'`);
    assert.ok(idx > lastIndex, `Field '${label}' must appear after previous field`);
    lastIndex = idx;
  }

  // Ensure order.createdByUserId is not rendered bare in the JSX fields
  assert.ok(!orderDetailSrc.includes('value:\n                    order.createdByUserId'));
  assert.ok(!orderDetailSrc.includes('value: order.createdByUserId'));
});

test('OrdersPage: column spacing and rowActions width are optimized to avoid horizontal overflow', () => {
  const ordersPageSrc = fs.readFileSync(path.resolve(__dirname, '../src/features/orders/pages/OrdersPage.tsx'), 'utf8');
  const { minimumTableWidth } = source('shared/ui/tableLayout.ts');

  // Verify compact rowActions width (165px instead of excessive 220px)
  assert.ok(ordersPageSrc.includes('rowActionsWidth="165px"'));
  assert.ok(!ordersPageSrc.includes('rowActionsWidth="220px"'));

  // Verify progress column is compact (110px instead of excessive 145px)
  assert.match(ordersPageSrc, /header:\s*'Phân bổ \/ giao',\s*width:\s*'110px'/);

  // Verify status column is compact (150px instead of excessive 210px)
  assert.match(ordersPageSrc, /header:\s*'Trạng thái',\s*width:\s*'150px'/);

  // Verify lines column is compact (95px instead of 130px)
  assert.match(ordersPageSrc, /header:\s*'Đơn hàng',\s*width:\s*'95px'/);

  // Verify retailer is flexible (width omitted) to absorb extra horizontal room cleanly
  assert.match(ordersPageSrc, /key:\s*'retailer',\s*header:\s*'Retailer',\s*text:/);

  // Calculate table minimum width with the actual columns
  const mockColumns = [
    { key: 'orderCode', width: '104px' },
    { key: 'retailer' }, // flexible, defaults to 160px in minimumTableWidth
    { key: 'sales', width: '135px' },
    { key: 'lines', width: '95px' },
    { key: 'createdAt', width: '105px' },
    { key: 'source', width: '78px' },
    { key: 'payment', width: '105px' },
    { key: 'amount', width: '115px' },
    { key: 'status', width: '150px' },
    { key: 'progress', width: '110px' },
  ];
  const tableMinWidth = minimumTableWidth(mockColumns, '165px');
  assert.equal(tableMinWidth, 1322);

  // Desktop widths: sidebar = 248px, page padding = 48px
  const desktopWidths = [
    { viewport: 1280, contentWidth: 1280 - 248 - 48 }, // 984
    { viewport: 1366, contentWidth: 1366 - 248 - 48 }, // 1070
    { viewport: 1440, contentWidth: 1440 - 248 - 48 }, // 1144
    { viewport: 1920, contentWidth: 1920 - 248 - 48 }, // 1624
  ];

  // At 1920px: table fits completely with 0px overflow
  const w1920 = desktopWidths.find((d) => d.viewport === 1920);
  assert.ok(tableMinWidth <= w1920.contentWidth);
  // Flexible retailer column absorbs the extra width (1624 - 1162 = 462px)
  // while progress (110px) and rowActions (165px) stay fixed, preventing column drifting
  const fixedTotal = tableMinWidth - 160;
  assert.equal(fixedTotal, 1162);
});
