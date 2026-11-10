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
const filters = source('features/kpi/filters.ts');

const user = (role, scope = {}) => ({
  id: 'user-' + role.toLowerCase(),
  role,
  name: role + ' User',
  email: role.toLowerCase() + '@example.com',
  scope,
});

test('getPeriodDates returns correct dates for month, lastMonth, quarter, year', () => {
  const refDate = '2026-05-15';

  // 1. Month: 1st of May to 15th of May
  const monthDates = filters.getPeriodDates('month', refDate);
  assert.equal(monthDates.fromDate, '2026-05-01');
  assert.equal(monthDates.toDate, '2026-05-15');

  // 2. Last Month: 1st of April to 30th of April (April has 30 days)
  const lastMonthDates = filters.getPeriodDates('lastMonth', refDate);
  assert.equal(lastMonthDates.fromDate, '2026-04-01');
  assert.equal(lastMonthDates.toDate, '2026-04-30');

  // 3. Last Month from January rolls back to previous year December (31 days)
  const janDate = '2026-01-10';
  const decDates = filters.getPeriodDates('lastMonth', janDate);
  assert.equal(decDates.fromDate, '2025-12-01');
  assert.equal(decDates.toDate, '2025-12-31');

  // 4. Quarter: Q2 starts on 2026-04-01 to 2026-05-15
  const quarterDates = filters.getPeriodDates('quarter', refDate);
  assert.equal(quarterDates.fromDate, '2026-04-01');
  assert.equal(quarterDates.toDate, '2026-05-15');

  // 5. Year: 2026-01-01 to 2026-05-15
  const yearDates = filters.getPeriodDates('year', refDate);
  assert.equal(yearDates.fromDate, '2026-01-01');
  assert.equal(yearDates.toDate, '2026-05-15');
});

test('validateReportFilters validates date presence, chronology, future dates and UUIDs', () => {
  const validFilters = {
    fromDate: '2026-01-01',
    toDate: '2026-01-31',
    salesGroupId: 'e1344584-bd39-45a0-b9f4-eb4f3510f3a1',
    salesUserId: '',
    criterion: 'Quantity',
  };

  // Valid filters returns undefined (no error)
  assert.equal(filters.validateReportFilters(validFilters), undefined);

  // Missing fromDate
  assert.match(
    filters.validateReportFilters({ ...validFilters, fromDate: '' }) || '',
    /ngày bắt đầu/i,
  );

  // Missing toDate
  assert.match(
    filters.validateReportFilters({ ...validFilters, toDate: '' }) || '',
    /ngày bắt đầu/i,
  );

  // Invalid date format
  assert.match(
    filters.validateReportFilters({ ...validFilters, fromDate: '2026/01/01' }) || '',
    /ngày bắt đầu/i,
  );

  // fromDate > toDate
  assert.match(
    filters.validateReportFilters({
      ...validFilters,
      fromDate: '2026-02-01',
      toDate: '2026-01-15',
    }) || '',
    /không được sau/i,
  );

  // Future fromDate beyond 2099
  assert.match(
    filters.validateReportFilters({
      ...validFilters,
      fromDate: '2099-01-01',
      toDate: '2099-01-31',
    }) || '',
    /tương lai/i,
  );

  // Future toDate beyond today
  assert.match(
    filters.validateReportFilters({
      ...validFilters,
      fromDate: '2026-01-01',
      toDate: '2099-01-31',
    }) || '',
    /ngày kết thúc không được trong tương lai/i,
  );

  // Invalid salesGroupId format
  assert.match(
    filters.validateReportFilters({
      ...validFilters,
      salesGroupId: 'invalid--group--uuid',
    }) || '',
    /mã nhóm sales không hợp lệ/i,
  );

  // Valid salesUserId UUID
  assert.equal(
    filters.validateReportFilters({
      ...validFilters,
      salesUserId: 'e1344584-bd39-45a0-b9f4-eb4f3510f3aa',
    }),
    undefined,
  );

  // Invalid salesUserId format
  assert.match(
    filters.validateReportFilters({
      ...validFilters,
      salesUserId: 'not--a--uuid',
    }) || '',
    /mã nhân viên sales không hợp lệ/i,
  );
});

test('safeCompletion handles target=0, negative, and overflow correctly', () => {
  assert.equal(filters.safeCompletion(50, 100), 50);
  assert.equal(filters.safeCompletion(120, 100), 120);

  // Target = 0 should return null, avoiding divide-by-zero / NaN / Infinity
  assert.equal(filters.safeCompletion(100, 0), null);
  assert.equal(filters.safeCompletion(0, 0), null);
  assert.equal(filters.safeCompletion(null, 100), null);
  assert.equal(filters.safeCompletion(100, null), null);
});

test('formatCompletion and completionTone return appropriate tones and Vietnamese formatting', () => {
  assert.equal(filters.formatCompletion(105.4), '105.4%');
  assert.equal(filters.completionTone(105.4), 'success');

  assert.equal(filters.formatCompletion(85.0), '85%');
  assert.equal(filters.completionTone(85.0), 'neutral');

  assert.equal(filters.formatCompletion(52.3), '52.3%');
  assert.equal(filters.completionTone(52.3), 'danger');

  assert.equal(filters.formatCompletion(null), '—');
  assert.equal(filters.completionTone(null), 'neutral');
});

test('readReportFilters and reportSearch maintain filter state in query string', () => {
  const sample = {
    fromDate: '2026-03-01',
    toDate: '2026-03-31',
    salesGroupId: 'e1344584-bd39-45a0-b9f4-eb4f3510f3a1',
    salesUserId: 'e1344584-bd39-45a0-b9f4-eb4f3510f3aa',
    criterion: 'Revenue',
    periodType: 'month',
  };

  const qs = filters.reportSearch(sample, 'kpi');
  assert.match(qs, /fromDate=2026-03-01/);
  assert.match(qs, /toDate=2026-03-31/);
  assert.match(qs, /salesGroupId=e1344584-bd39-45a0-b9f4-eb4f3510f3a1/);
  assert.match(qs, /salesUserId=e1344584-bd39-45a0-b9f4-eb4f3510f3aa/);
  assert.match(qs, /tab=kpi/);
  assert.match(qs, /periodType=month/);

  const parsed = filters.readReportFilters(qs);
  assert.equal(parsed.fromDate, '2026-03-01');
  assert.equal(parsed.toDate, '2026-03-31');
  assert.equal(parsed.salesGroupId, 'e1344584-bd39-45a0-b9f4-eb4f3510f3a1');
  assert.equal(parsed.salesUserId, 'e1344584-bd39-45a0-b9f4-eb4f3510f3aa');
  assert.equal(parsed.periodType, 'month');

  assert.equal(filters.readRankingTab(qs), 'kpi');

  // Empty query string defaults cleanly to 'month' preset, avoiding false custom trigger
  const emptyParsed = filters.readReportFilters('');
  assert.equal(emptyParsed.periodType, 'month');

  // URL with explicit custom dates but no periodType param correctly resolves to 'custom'
  const customParsed = filters.readReportFilters('?fromDate=2026-02-01&toDate=2026-02-28');
  assert.equal(customParsed.periodType, 'custom');
  assert.equal(customParsed.fromDate, '2026-02-01');
  assert.equal(customParsed.toDate, '2026-02-28');
});

// Test RBAC & API boundary mocks
let mockCalls = [];
const mockClient = {
  get: async (url, config) => {
    mockCalls.push({ method: 'GET', url, config });
    if (url.includes('/reports/sales-kpis')) {
      return {
        fromDate: config?.params?.fromDate,
        toDate: config?.params?.toDate,
        scope: 'PortalWide',
        configurationVersion: 'v1.0',
        configurationEffectiveFrom: '2026-01-01',
        recognitionRule: 'Doanh thu ghi nhận = Tiền trước KM - Khuyến mãi + Tiền điều chỉnh',
        entries: [
          {
            salesUserId: 'e1344584-bd39-45a0-b9f4-eb4f3510f3aa',
            salesUserName: 'Nguyễn Văn A',
            salesGroupId: 'e1344584-bd39-45a0-b9f4-eb4f3510f3a1',
            salesGroupCode: 'SG01',
            salesGroupName: 'Nhóm Miền Bắc',
            regionId: 'reg-north',
            overallCompletionRate: 95.5,
            recognizedRevenue: 95500000,
            metrics: [
              {
                code: 'REV',
                name: 'Doanh thu thuần',
                target: 100000000,
                actual: 95500000,
                unit: 'đ',
                weight: 70,
                completionRate: 95.5,
              },
            ],
            orders: [
              {
                orderId: 'ord-01',
                orderCode: 'ORD-2026-0001',
                retailerId: 'ret-01',
                retailerCode: 'RET01',
                retailerName: 'Đại lý An Bình',
                recognitionDate: '2026-03-10',
                revenueBeforePromotion: 100000000,
                promotionAmount: 5000000,
                revenueAfterPromotion: 95000000,
                approvedAdjustmentAmount: 500000,
                recognizedRevenue: 95500000,
              },
            ],
          },
        ],
      };
    }
    if (url.includes('/sales-groups')) {
      return [
        { id: 'e1344584-bd39-45a0-b9f4-eb4f3510f3a1', code: 'SG01', name: 'Nhóm Miền Bắc' },
        { id: 'e1344584-bd39-45a0-b9f4-eb4f3510f3a2', code: 'SG02', name: 'Nhóm Miền Trung' },
        { id: 'e1344584-bd39-45a0-b9f4-eb4f3510f3a3', code: 'SG03', name: 'Nhóm Miền Nam' },
      ];
    }
    if (url.includes('/territory-assignments/sales')) {
      return [
        { salesUserId: 'e1344584-bd39-45a0-b9f4-eb4f3510f3aa', salesUserCode: 'NV01', salesUserName: 'Nguyễn Văn A', salesGroupId: 'e1344584-bd39-45a0-b9f4-eb4f3510f3a1' },
        { salesUserId: 'e1344584-bd39-45a0-b9f4-eb4f3510f3bb', salesUserCode: 'NV02', salesUserName: 'Trần Thị B', salesGroupId: 'e1344584-bd39-45a0-b9f4-eb4f3510f3a2' },
      ];
    }
    if (url.includes('/configurations/kpi.weights')) {
      return {
        value: {
          revenueWeight: 70,
          ordersWeight: 15,
          newRetailersWeight: 15,
        },
      };
    }
    return {};
  },
  put: async (url, data) => {
    mockCalls.push({ method: 'PUT', url, data });
    return data;
  },
};

const api = source('features/kpi/api.ts', {
  '@/shared/api/http': mockClient,
  '@/shared/api/errors': errors,
  './filters': filters,
});

test('RBAC: rankings.read allowed for Admin, Operator, SalesManager; denied for WarehouseKeeper, Retailer', () => {
  assert.equal(api.canReadRankings(user('Admin')), true);
  assert.equal(api.canReadRankings(user('Operator')), true);
  assert.equal(api.canReadRankings(user('SalesManager')), true);
  assert.equal(api.canReadRankings(user('WarehouseKeeper')), false);
  assert.equal(api.canReadRankings(user('Retailer')), false);
});

test('RBAC: canManageKpi allowed strictly for Admin; denied for SalesManager and Operator', () => {
  assert.equal(api.canManageKpi(user('Admin')), true);
  assert.equal(api.canManageKpi(user('SalesManager')), false);
  assert.equal(api.canManageKpi(user('Operator')), false);
  assert.equal(api.canManageKpi(user('WarehouseKeeper')), false);
});

test('SalesManager is strictly scoped to assigned salesGroupIds', async () => {
  const smUser = user('SalesManager', {
    salesGroupIds: [
      'e1344584-bd39-45a0-b9f4-eb4f3510f3a1',
      'e1344584-bd39-45a0-b9f4-eb4f3510f3a3',
    ],
  });
  const groups = await api.kpiApi.groups(smUser);

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((g) => g.id),
    [
      'e1344584-bd39-45a0-b9f4-eb4f3510f3a1',
      'e1344584-bd39-45a0-b9f4-eb4f3510f3a3',
    ],
  );
  assert.ok(!groups.some((g) => g.id === 'e1344584-bd39-45a0-b9f4-eb4f3510f3a2'));

  // Admin sees all groups
  const adminGroups = await api.kpiApi.groups(user('Admin'));
  assert.equal(adminGroups.length, 3);
});

test('kpiApi.kpi fetches reports/sales-kpis and correctly parses entries and orders', async () => {
  mockCalls = [];
  const report = await api.kpiApi.kpi(
    {
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      salesGroupId: 'e1344584-bd39-45a0-b9f4-eb4f3510f3a1',
      salesUserId: '',
      criterion: 'Quantity',
    },
    user('Admin'),
  );

  assert.equal(mockCalls.length, 1);
  assert.equal(mockCalls[0].url, '/reports/sales-kpis');
  assert.equal(mockCalls[0].config.fromDate, '2026-03-01');
  assert.equal(mockCalls[0].config.salesGroupId, 'e1344584-bd39-45a0-b9f4-eb4f3510f3a1');
  assert.equal(mockCalls[0].config.salesUserId, undefined); // empty string omitted

  assert.equal(report.entries.length, 1);
  const entry = report.entries[0];
  assert.equal(entry.salesUserName, 'Nguyễn Văn A');
  assert.equal(entry.overallCompletionRate, 95.5);
  assert.equal(entry.orders.length, 1);

  // Business formula verification
  const order = entry.orders[0];
  const expectedRecognized =
    order.revenueBeforePromotion - order.promotionAmount + order.approvedAdjustmentAmount;
  assert.equal(order.recognizedRevenue, expectedRecognized);
  assert.equal(order.recognizedRevenue, 95500000);
});

test('Admin can configure KPI weights and validate total weight = 100', async () => {
  mockCalls = [];
  const cfg = await api.kpiApi.getKpiConfig(user('Admin'));
  assert.equal(cfg.revenueWeight, 70);
  assert.equal(cfg.ordersWeight, 15);
  assert.equal(cfg.newRetailersWeight, 15);

  await api.kpiApi.saveKpiConfig(
    {
      revenueWeight: 60,
      ordersWeight: 20,
      newRetailersWeight: 20,
      note: 'Điều chỉnh quý 2',
    },
    user('Admin'),
  );

  assert.equal(mockCalls[mockCalls.length - 1].method, 'PUT');
  assert.equal(mockCalls[mockCalls.length - 1].url, '/configurations/kpi.weights');
  assert.equal(mockCalls[mockCalls.length - 1].data.value.revenueWeight, 60);

  // Non-admin save attempt rejects
  await assert.rejects(
    api.kpiApi.saveKpiConfig(
      { revenueWeight: 60, ordersWeight: 20, newRetailersWeight: 20 },
      user('SalesManager'),
    ),
    /quyền/i,
  );
});
