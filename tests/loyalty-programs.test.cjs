const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) throw new Error('Missing mock: ' + name);
    return require(name);
  }, module, module.exports);
  return module.exports;
}

const errors = source('shared/api/errors.ts');
const form = source('features/loyalty/programForm.ts', { '@/shared/api/errors': errors });
const retailerId = '11111111-1111-4111-8111-111111111111';
const program = {
  id: '22222222-2222-4222-8222-222222222222', code: 'LP-001',
  name: 'Chương trình tháng 11', description: 'Quy đổi điểm',
  spendAmountPerPoint: 12345.67, minimumRedeemPoints: 0,
  startAt: '2026-10-31T17:00:00.123Z', endAt: '2026-11-30T16:59:59.999Z',
  pointsExpireAt: '2026-12-31T16:59:59.999Z',
  retailerIds: [retailerId], isActive: false,
  createdByUserId: 'admin', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
};

test('editing preserves precise instants and decimal conversion rate in Vietnam time', () => {
  const initial = form.programInitial(program);
  assert.equal(initial.startAt, '2026-11-01T00:00:00.123');
  const payload = form.programPayload(initial);
  for (const key of ['startAt', 'endAt', 'pointsExpireAt', 'spendAmountPerPoint', 'minimumRedeemPoints']) {
    assert.equal(payload[key], program[key]);
  }
  assert.deepEqual(payload.retailerIds, [retailerId]);
  assert.equal(form.vietnamInputToIso('2026-11-01T00:00'), '2026-10-31T17:00:00.000Z');
});

test('validation mirrors BE ordering, optional expiry, positive rate and integer points', () => {
  const values = form.programInitial(program);
  assert.deepEqual(form.validateProgram(values), {});
  assert.equal(form.programPayload({ ...values, pointsExpireAt: '' }).pointsExpireAt, null);
  for (const invalid of [
    { name: 'a' }, { spendAmountPerPoint: 0 }, { spendAmountPerPoint: 'Infinity' },
    { minimumRedeemPoints: -1 }, { minimumRedeemPoints: 0.5 },
    { endAt: values.startAt }, { pointsExpireAt: values.startAt },
    { retailerIds: [] }, { retailerIds: ['LP-001'] },
    { startAt: '2026-02-30T12:00' },
  ]) {
    assert.throws(() => form.programPayload({ ...values, ...invalid }), errors.ApiError);
  }
  const error = (() => { try { form.programPayload({ ...values, retailerIds: [] }); } catch (e) { return e; } })();
  assert.ok(error.field('RetailerIds'));
});

test('scheduled, inactive and expired are separate states; enabled does not mean in effect', () => {
  const now = Date.parse('2026-11-11T00:00:00Z');
  assert.equal(form.programStatus(program, now), 'Chưa kích hoạt / tạm dừng');
  assert.equal(form.programStatus({ ...program, isActive: true }, now), 'Đang hiệu lực');
  assert.equal(form.programStatus({ ...program, isActive: true, startAt: '2026-11-20T00:00:00Z' }, now),
    'Đã bật · chờ hiệu lực');
  assert.equal(form.programStatus({ ...program, isActive: true, endAt: '2026-11-01T00:00:00Z' }, now),
    'Đã hết hạn');
});

test('list includes inactive programs; create/update use UUID and separate state endpoints', async () => {
  const calls = [];
  const { loyaltyApi } = source('features/loyalty/api.ts', {
    '@/shared/api/errors': errors,
    '@/shared/api/http': {
      get: async (url, params) => { calls.push({ method: 'GET', url, params }); return [program]; },
      post: async (url, body) => { calls.push({ method: 'POST', url, body }); return program; },
      put: async (url, body) => { calls.push({ method: 'PUT', url, body }); return program; },
    },
  });
  await loyaltyApi.programs();
  const payload = form.programPayload(form.programInitial(program));
  await loyaltyApi.createProgram(payload);
  await loyaltyApi.updateProgram({ ...payload, id: program.id });
  await loyaltyApi.setProgramActive({ id: program.id, active: true });
  await loyaltyApi.setProgramActive({ id: program.id, active: false });
  assert.deepEqual(calls[0], { method: 'GET', url: '/loyalty/programs', params: { includeInactive: true } });
  assert.deepEqual(calls[1], { method: 'POST', url: '/loyalty/programs', body: payload });
  assert.deepEqual(calls[2], { method: 'PUT', url: '/loyalty/programs/' + program.id, body: payload });
  assert.equal(calls[3].url, '/loyalty/programs/' + program.id + '/activate');
  assert.equal(calls[4].url, '/loyalty/programs/' + program.id + '/deactivate');
  assert.equal('isActive' in calls[1].body, false);
  assert.equal('id' in calls[2].body, false);
});

test('retailer picker loads all pages with pageSize 100 and propagates failed reads', async () => {
  const calls = [];
  let fail = false;
  const { loyaltyApi } = source('features/loyalty/api.ts', {
    '@/shared/api/errors': errors,
    '@/shared/api/http': {
      get: async (url, params) => {
        calls.push({ url, params });
        if (fail) throw new errors.ApiError(403, 'Forbidden');
        const count = params.page === 1 ? 100 : 1;
        return { totalCount: 101, items: Array.from({ length: count }, (_, i) => ({
          id: retailerId + '-' + params.page + '-' + i, code: String(i),
          name: 'Retailer', status: 'Active',
        })) };
      },
    },
  });
  assert.equal((await loyaltyApi.programRetailers()).length, 101);
  assert.deepEqual(calls.map((c) => c.params), [{ page: 1, pageSize: 100 }, { page: 2, pageSize: 100 }]);
  fail = true;
  await assert.rejects(loyaltyApi.programRetailers(), { status: 403 });
});

test('missing program audience is not treated as an empty business result', async () => {
  const { loyaltyApi } = source('features/loyalty/api.ts', {
    '@/shared/api/errors': errors,
    '@/shared/api/http': { get: async () => [{ ...program, retailerIds: undefined }] },
  });
  await assert.rejects(loyaltyApi.programs(), { status: 502 });
});

test('F69 preserves balances and retailer detail navigation on the existing loyalty page', () => {
  let table;
  const { LoyaltyPage } = source('features/loyalty/pages/LoyaltyPage.tsx', {
    '@/shared/router/compat': { useNavigate: () => () => {} },
    '@/shared/lib': { formatDate: String, formatNumber: String },
    '@/shared/ui': {
      PageHeader: () => null, Button: () => null,
      DataTable: (props) => { table = props; return null; },
    },
    '../hooks': { useBalances: () => ({ data: [{ retailerCode: '1001' }] }) },
    '../components/LoyaltyProgramsPanel': { LoyaltyProgramsPanel: () => React.createElement('p', null, 'PROGRAMS') },
  });
  assert.match(renderToStaticMarkup(React.createElement(LoyaltyPage)), /PROGRAMS/);
  assert.equal(table.rows[0].retailerCode, '1001');
  assert.equal(typeof table.onRowClick, 'function');
  assert.equal(typeof table.rowActions, 'function');
});

test('program dialog uses real retailer selection and keeps backend errors without closing', async () => {
  let props;
  let closed = 0;
  let request;
  let fail = false;
  const serverError = new errors.ApiError(409, 'Program changed');
  const { ProgramDialog } = source('features/loyalty/components/ProgramDialog.tsx', {
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { role: 'Admin' } }) },
    '@/shared/auth/permissions': { assertPermission: () => {} },
    '@/shared/ui': { FormDialog: (value) => { props = value; return null; } },
    '../hooks': {
      useCreateProgram: () => ({ mutateAsync: async (input) => { request = input; } }),
      useUpdateProgram: () => ({ mutateAsync: async (input) => {
        if (fail) throw serverError;
        request = input;
      } }),
      useProgramRetailers: () => ({ data: [{ id: retailerId, code: '1001', name: 'Retailer', status: 'Active' }] }),
    },
    '../programForm': form,
    './ProgramRetailerPicker': { ProgramRetailerPicker: () => null },
  });
  renderToStaticMarkup(React.createElement(ProgramDialog, {
    program, onClose: () => { closed += 1; },
  }));
  assert.equal(props.fields.find((f) => f.key === 'retailerIds').type, 'custom');
  assert.equal(props.fields.find((f) => f.key === 'startAt').type, 'datetime-local');
  await props.onSubmit(props.initial);
  assert.equal(request.id, program.id);
  assert.deepEqual(request.retailerIds, [retailerId]);
  assert.equal(closed, 1);
  fail = true;
  await assert.rejects(props.onSubmit(props.initial), { status: 409 });
  assert.equal(closed, 1);
});

test('unchanged form preserves backend timestamp precision beyond milliseconds', () => {
  const precise = { ...program, startAt: '2026-10-31T17:00:00.1234567Z' };
  assert.equal(form.programPayload(form.programInitial(precise), precise).startAt, precise.startAt);
});
