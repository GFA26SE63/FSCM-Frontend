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

test('Retailer Edit: "Sửa thông tin" button action in RetailerDetailPage and permission control', () => {
  const detailFile = path.resolve(__dirname, '../src/features/retailers/pages/RetailerDetailPage.tsx');
  const detailCode = fs.readFileSync(detailFile, 'utf8');

  // Permission check for retailers.edit
  assert.ok(detailCode.includes("const mayEdit = can(user, 'retailers.edit')"));
  assert.ok(detailCode.includes('Sửa thông tin'));
  assert.ok(detailCode.includes('onClick={() => setEdit(true)}'));
  assert.ok(detailCode.includes('<RetailerFormDialog open={edit} retailer={r} onClose={() => setEdit(false)} />'));

  // Authorization rule check
  const permissions = source('shared/auth/permissions.ts', {
    '../api/errors': errors,
  });
  assert.equal(permissions.can({ role: 'Admin' }, 'retailers.edit'), true);
  assert.equal(permissions.can({ role: 'Operator' }, 'retailers.edit'), true);
  assert.equal(permissions.can({ role: 'SalesManager' }, 'retailers.edit'), false);
  assert.equal(permissions.can({ role: 'WarehouseKeeper' }, 'retailers.edit'), false);
  assert.equal(permissions.can({ role: 'Retailer' }, 'retailers.edit'), false);
});

test('Retailer Edit: retailerApi.updateDeclaration calls PUT /api/v1/retailers/{retailerId}/declaration with UUID', async () => {
  const putCalls = [];
  const mockHttp = {
    get: async () => {},
    getAll: async () => [],
    post: async () => {},
    put: async (url, payload) => {
      putCalls.push({ url, payload });
      return {
        id: 'b1a2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        code: '10000001',
        name: payload.name,
      };
    },
    del: async () => {},
  };

  const apiModule = source('features/retailers/api.ts', {
    '@/shared/api/http': mockHttp,
    '@/shared/api/errors': errors,
  });

  const uuid = 'b1a2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  const payload = {
    name: 'Đại lý Sữa Tươi Cập Nhật',
    contactName: 'Nguyễn Văn B',
    phone: '0901234567',
    email: 'contact@suatuoi.vn',
    address: '123 Đường Láng, Hà Nội',
    retailerType: 'Tạp hóa',
    forecastRevenue: 50000000,
    storeSizeSquareMeters: 45,
    purchasingCapacity: 120,
    purchaseFrequencyPerMonth: 4,
    requestedCreditTermDays: 14,
    assessmentNote: 'Khách hàng tiềm năng cao',
    latitude: 21.01234,
    longitude: 105.81234,
  };

  const res = await apiModule.retailerApi.updateDeclaration(uuid, payload);
  assert.equal(res.name, 'Đại lý Sữa Tươi Cập Nhật');
  assert.equal(putCalls.length, 1);
  assert.equal(putCalls[0].url, `/retailers/${uuid}/declaration`);
  assert.deepEqual(putCalls[0].payload, payload);
});

test('Retailer Edit: retailerApi.updateDeclaration resolves 8-digit code to UUID before PUT call', async () => {
  const getCalls = [];
  const putCalls = [];
  const mockHttp = {
    get: async (url, config) => {
      getCalls.push({ url, config });
      if (url === '/retailers') {
        return {
          items: [
            {
              id: 'c2b3a4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d',
              code: '10000002',
              name: 'Tạp hóa Bình An',
            },
          ],
          totalCount: 1,
        };
      }
      if (url === '/retailers/c2b3a4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d') {
        return {
          id: 'c2b3a4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d',
          code: '10000002',
          name: 'Tạp hóa Bình An',
        };
      }
      throw new errors.ApiError(404, 'Not found');
    },
    getAll: async () => [],
    post: async () => {},
    put: async (url, payload) => {
      putCalls.push({ url, payload });
      return { id: 'c2b3a4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d', ...payload };
    },
    del: async () => {},
  };

  const apiModule = source('features/retailers/api.ts', {
    '@/shared/api/http': mockHttp,
    '@/shared/api/errors': errors,
  });

  const res = await apiModule.retailerApi.updateDeclaration('10000002', {
    name: 'Tạp hóa Bình An Mới',
    contactName: 'Trần Văn C',
    phone: '0912345678',
  });

  assert.equal(putCalls.length, 1);
  assert.equal(putCalls[0].url, '/retailers/c2b3a4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d/declaration');
});

test('Retailer Lookups: retailerApi.areas calls /regions and retailerApi.groups calls /sales-groups', async () => {
  const getAllCalls = [];
  const mockHttp = {
    get: async () => {},
    getAll: async (url) => {
      getAllCalls.push(url);
      if (url === '/regions') {
        return [
          { id: 'reg-01', code: 'KV-HN', name: 'Khu vực Hà Nội' },
          { id: 'reg-02', code: 'KV-HCM', name: 'Khu vực TP.HCM' },
        ];
      }
      if (url === '/sales-groups') {
        return [
          { id: 'sg-01', code: 'SG-HN-01', name: 'Nhóm Sales 01', regionCode: 'KV-HN', regionId: 'reg-01' },
        ];
      }
      return [];
    },
    post: async () => {},
    put: async () => {},
    del: async () => {},
  };

  const apiModule = source('features/retailers/api.ts', {
    '@/shared/api/http': mockHttp,
    '@/shared/api/errors': errors,
  });

  const areas = await apiModule.retailerApi.areas();
  assert.equal(areas.length, 2);
  assert.equal(areas[0].code, 'KV-HN');
  assert.equal(areas[0].name, 'Khu vực Hà Nội');

  const groups = await apiModule.retailerApi.groups();
  assert.equal(groups.length, 1);
  assert.equal(groups[0].code, 'SG-HN-01');
  assert.equal(groups[0].areaCode, 'KV-HN');

  assert.ok(getAllCalls.includes('/regions'));
  assert.ok(getAllCalls.includes('/sales-groups'));
  assert.ok(!getAllCalls.includes('/areas'));
});

test('Retailer Form Dialog Integrity: pre-populates fields, keeps code & region read-only on edit, and submits valid declaration payload', () => {
  const formFile = path.resolve(__dirname, '../src/features/retailers/components/RetailerFormDialog.tsx');
  const formCode = fs.readFileSync(formFile, 'utf8');

  // Must not block on lookups undefined
  assert.ok(!formCode.includes('if (!open || !areas.data || !groups.data) return null;'));
  assert.ok(formCode.includes('if (!open) return null;'));

  // Shows loading indicator when lookups are loading
  assert.ok(formCode.includes('areas.isLoading || groups.isLoading'));
  assert.ok(formCode.includes('Đang tải dữ liệu biểu mẫu…'));

  // Preserves existing retailer values
  assert.ok(formCode.includes('retailer.name'));
  assert.ok(formCode.includes('retailer.contactName'));
  assert.ok(formCode.includes('retailer.phone'));
  assert.ok(formCode.includes('retailer.address'));
  assert.ok(formCode.includes('retailer.forecastRevenue'));
  assert.ok(formCode.includes('retailer.purchasingCapacity'));
  assert.ok(formCode.includes('retailer.requestedCreditTermDays'));

  // Read-only on edit mode
  assert.ok(formCode.includes('readOnly: edit'));

  // Update declaration payload uses exact OpenAPI properties
    assert.ok(formCode.includes('updateProfile.mutateAsync({'));
  assert.ok(formCode.includes('profilePayload'));
  assert.ok(formCode.includes('requestedCreditTermDays: creditDays'));

  // No fake fallback to non-existent /retailers/{code} in edit flow
  assert.ok(!formCode.includes('update.mutateAsync({'));
});

test('Admin profile update uses a separate endpoint and preserves the Sales declaration API', async () => {
  const calls = [];
  const api = source('features/retailers/api.ts', {
    '@/shared/api/http': { put: async (url, body) => { calls.push({ url, body }); return body; } },
    '@/shared/api/errors': errors,
  }).retailerApi;
  const id = 'b1a2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  const profile = { name: 'Updated store', contactName: 'Contact', phone: '0909888777', email: 'updated@retailer.test' };
  await api.updateProfile(id, profile);
  await api.updateDeclaration(id, { ...profile, submitForReview: true });
  assert.equal(calls[0].url, `/retailers/${id}/profile`);
  assert.deepEqual(calls[0].body, profile);
  assert.equal(calls[1].url, `/retailers/${id}/declaration`);
  assert.equal(calls[1].body.submitForReview, true);
  await assert.rejects(api.updateProfile('', profile), { status: 400 });
});

test('Retailer Hooks Integrity: profile and declaration updates retain cache invalidation', () => {
  const hooksFile = path.resolve(__dirname, '../src/features/retailers/hooks.ts');
  const hooksCode = fs.readFileSync(hooksFile, 'utf8');

  assert.ok(hooksCode.includes("permission: 'retailers.edit'"));
  assert.ok(hooksCode.includes("success: 'Cập nhật thông tin Retailer thành công.'"));
  assert.ok(hooksCode.includes('retailerApi.updateProfile(retailerId, payload)'));
  assert.ok(hooksCode.includes("queryClient.invalidateQueries({ queryKey: ['retailers'] })"));
});
