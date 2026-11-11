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

test('Retailer Loading: retailerApi.get uses direct UUID path for GET /retailers/{retailerId}', async () => {
  const mockHttp = {
    getCalls: [],
    get: async (url, config) => {
      mockHttp.getCalls.push({ url, config });
      if (url === '/retailers/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11') {
        return {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          code: '10000001',
          name: 'Đại lý Sữa Tươi Hà Nội',
          status: 'Active',
          creditTermDays: 14,
        };
      }
      throw new errors.ApiError(404, 'Không tìm thấy Retailer');
    },
    getAll: async () => [],
    post: async () => {},
    put: async () => {},
    del: async () => {},
  };

  const apiModule = source('features/retailers/api.ts', {
    '@/shared/api/http': mockHttp,
    '@/shared/api/errors': errors,
  });

  const uuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const retailer = await apiModule.retailerApi.get(uuid);

  // Directly hits /retailers/{uuid} without calling list or constructing fake object
  assert.equal(mockHttp.getCalls.length, 1);
  assert.equal(mockHttp.getCalls[0].url, `/retailers/${uuid}`);
  assert.equal(retailer.id, uuid);
  assert.equal(retailer.code, '10000001');
  assert.equal(retailer.name, 'Đại lý Sữa Tươi Hà Nội');
});

test('Retailer Loading: retailerApi.get resolves 8-digit code to UUID via backend search without fake object substitution', async () => {
  const targetUuid = 'b1ffcd88-8b1a-4de7-aa5c-7aa8ac270b22';
  const mockHttp = {
    getCalls: [],
    get: async (url, params) => {
      mockHttp.getCalls.push({ url, params });
      if (url === '/retailers' && params?.search === '10000002') {
        return {
          items: [
            {
              id: targetUuid,
              code: '10000002',
              name: 'Tạp hóa Bách Khoa',
              status: 'Active',
            },
          ],
          totalCount: 1,
        };
      }
      if (url === `/retailers/${targetUuid}`) {
        return {
          id: targetUuid,
          code: '10000002',
          name: 'Tạp hóa Bách Khoa',
          address: '123 Tạ Quang Bửu, Hà Nội',
          contactName: 'Trần Văn B',
          phone: '0987654321',
          email: 'bachkhoa@example.com',
          status: 'Active',
          creditTermDays: 30,
        };
      }
      throw new errors.ApiError(404, 'Not found');
    },
    getAll: async () => [],
    post: async () => {},
    put: async () => {},
    del: async () => {},
  };

  const apiModule = source('features/retailers/api.ts', {
    '@/shared/api/http': mockHttp,
    '@/shared/api/errors': errors,
  });

  const result = await apiModule.retailerApi.get('10000002');

  // Verify resolution flow: first searches by code, then fetches real detail with UUID
  assert.equal(mockHttp.getCalls.length, 2);
  assert.equal(mockHttp.getCalls[0].url, '/retailers');
  assert.equal(mockHttp.getCalls[0].params.search, '10000002');
  assert.equal(mockHttp.getCalls[1].url, `/retailers/${targetUuid}`);

  // Returns full detail from the second request, not partial list-row object
  assert.equal(result.id, targetUuid);
  assert.equal(result.address, '123 Tạ Quang Bửu, Hà Nội');
  assert.equal(result.creditTermDays, 30);
});

test('Retailer Loading: non-existent code throws user-friendly 404 ApiError', async () => {
  const mockHttp = {
    get: async (url) => {
      if (url === '/retailers') {
        return { items: [], totalCount: 0 };
      }
      throw new errors.ApiError(404, 'Not found');
    },
    getAll: async () => [],
    post: async () => {},
    put: async () => {},
    del: async () => {},
  };

  const apiModule = source('features/retailers/api.ts', {
    '@/shared/api/http': mockHttp,
    '@/shared/api/errors': errors,
  });

  await assert.rejects(
    async () => {
      await apiModule.retailerApi.get('99999999');
    },
    (err) => {
      assert.equal(err.status, 404);
      assert.ok(err.message.includes('Không tìm thấy Retailer này'));
      return true;
    },
  );
});

test('Navigation Integrity: RetailersPage always passes row.id to navigate to detail', () => {
  const pageCode = fs.readFileSync(
    path.resolve(__dirname, '../src/features/retailers/pages/RetailersPage.tsx'),
    'utf8',
  );

  // Both row click and Xem button pass row.id
  assert.ok(pageCode.includes('onRowClick={(row) => navigate(`/retailers/${row.id || row.code}`)}'));
  assert.ok(pageCode.includes('onClick={() => navigate(`/retailers/${row.id || row.code}`)}'));
  assert.ok(pageCode.includes('rowKey={(row) => row.id}'));
});

test('Error State Handling: RetailerDetailPage specifies user-friendly Vietnamese messages and retry actions', () => {
  const detailCode = fs.readFileSync(
    path.resolve(__dirname, '../src/features/retailers/pages/RetailerDetailPage.tsx'),
    'utf8',
  );

  // 404 Not Found message
  assert.ok(
    detailCode.includes(
      'Không tìm thấy Retailer này. Thông tin có thể đã được thay đổi hoặc không còn tồn tại.',
    ),
  );

  // 403 Forbidden message
  assert.ok(detailCode.includes('Bạn không có quyền xem thông tin Retailer này.'));

  // 401 Unauthorized message
  assert.ok(detailCode.includes('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'));

  // Network / server error message with retry button
  assert.ok(detailCode.includes('Không thể tải thông tin Retailer. Vui lòng thử lại.'));
  assert.ok(detailCode.includes('retailer.refetch()'));
  assert.ok(detailCode.includes('Thử lại'));

  // Field unavailable fallback: "Chưa có thông tin"
  assert.ok(detailCode.includes("'Chưa có thông tin'"));
});

test('Mock Data Audit: zero mock Retailer records, hardcoded IDs or simulated responses exist in runtime code', () => {
  const retailersDir = path.resolve(__dirname, '../src/features/retailers');
  const files = fs.readdirSync(retailersDir, { recursive: true });

  for (const rel of files) {
    const full = path.join(retailersDir, rel);
    if (!fs.statSync(full).isFile() || !/\.(ts|tsx)$/.test(rel)) continue;
    const content = fs.readFileSync(full, 'utf8');

    // Ensure no mock data arrays, fake responses, or mock keywords
    assert.equal(
      content.includes('mockRetailer'),
      false,
      `Found mockRetailer in ${rel}`,
    );
    assert.equal(
      content.includes('fakeRetailer'),
      false,
      `Found fakeRetailer in ${rel}`,
    );
    assert.equal(
      content.includes('dummyData'),
      false,
      `Found dummyData in ${rel}`,
    );
  }
});
