const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) throw Error('Missing mock: ' + name);
    return require(name);
  }, module, module.exports);
  return module.exports;
}
function hooks() {
  const state = []; let index = 0;
  const useState = initial => {
    const key = index++;
    if (!(key in state)) state[key] = typeof initial === 'function' ? initial() : initial;
    return [state[key], next => { state[key] = typeof next === 'function' ? next(state[key]) : next; }];
  };
  return { reset: () => { index = 0; }, useState, useRef: initial => useState(() => ({ current: initial }))[0] };
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...[node.props?.children, node.props?.actions, node.props?.footer].flat(Infinity).flatMap(child => nodes(child, predicate))];
}
const ui = Object.fromEntries(['Button', 'Callout', 'Card', 'Checkbox', 'DataTable', 'DateTimeInput', 'FormField', 'Input', 'TextArea', 'Modal', 'PageHeader'].map(key => [key, key]));
const errors = load('shared/api/errors.ts');

test('date display changes preserve Vietnam datetime values, seconds and clearable expiry', () => {
  const { DateTimeInput } = load('shared/ui/DateTimeInput.tsx', {
    './DateInput': { DateInput: 'Date' }, './FormField': { Input: 'Time' },
  });
  let changed;
  const tree = DateTimeInput({ value: '2026-11-23T14:35:12.123', onChange: v => { changed = v; } });
  const date = nodes(tree, n => n.type === 'Date')[0];
  const time = nodes(tree, n => n.type === 'Time')[0];
  assert.equal(date.props.value, '2026-11-23');
  assert.equal(time.props.value, '14:35:12.123');
  date.props.onChange('2026-11-24');
  assert.equal(changed, '2026-11-24T14:35:12.123');
  time.props.onChange({ target: { value: '16:45' } });
  assert.equal(changed, '2026-11-23T16:45');
  date.props.onChange(''); assert.equal(changed, '');
});

test('program retailer lookup uses one filtered GraphQL page and retains contact fields and errors', async () => {
  let call; let failure;
  const row = { id: 'r1', code: '1001', name: 'Shop', status: 'Active', contactName: 'An', phone: '0900000000', email: 'a@example.test', address: 'Address' };
  const { loyaltyApi } = load('features/loyalty/api.ts', {
    '@/shared/api/errors': errors, '@/shared/api/http': {},
    '@/shared/api/graphql': { graphql: async (query, variables) => {
      if (failure) throw failure;
      call = { query, variables };
      return { entities: { retailerProfiles: { items: [row], totalCount: 21 } } };
    } },
  });
  const result = await loyaltyApi.programRetailersPage(2, ' Shop ');
  assert.deepEqual(call.variables, { page: 2, search: 'Shop' });
  assert.match(call.query, /pageSize: 10/);
  assert.match(call.query, /status: "Active"/);
  assert.match(call.query, /contactName phone email address/);
  assert.deepEqual(result.items, [row]); assert.equal(result.totalCount, 21);
  failure = new errors.ApiError(403, 'Forbidden');
  await assert.rejects(loyaltyApi.programRetailersPage(1, ''), { status: 403 });
});

test('create route precedes retailer-code detail and refuses Operator access', () => {
  const { APP_ROUTES } = load('app/routes.tsx');
  const routes = APP_ROUTES.find(r => r.key === 'loyalty').sub;
  assert.equal(routes[0].path, 'new'); assert.equal(routes[1].path, ':code');
  let role = 'Operator';
  const { ProgramCreatePage } = load('features/loyalty/pages/ProgramCreatePage.tsx', {
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { role } }) },
    '@/shared/auth/permissions': { can: user => user.role === 'Admin' },
    '@/shared/router/compat': { useNavigate: () => () => {} }, '@/shared/ui': ui,
    '../components/ProgramCreateForm': { ProgramCreateForm: 'Form' },
  });
  assert.equal(ProgramCreatePage().type, 'Callout');
  role = 'Admin'; assert.equal(nodes(ProgramCreatePage(), n => n.type === 'Form').length, 1);
});

test('inline retailer selection persists across pages/search and can filter and unselect chosen rows', () => {
  const react = hooks();
  let queryOptions; let value = []; let fetching = false; let error; let disabled = false;
  const { ProgramRetailerTable } = load('features/loyalty/components/ProgramRetailerTable.tsx', {
    react, '@/shared/ui': ui,
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { id: 'admin', role: 'Admin' } }) },
    '@/shared/lib/status': { statusLabel: (_, value) => value }, '../api': { loyaltyApi: {} },
    '@tanstack/react-query': { useQuery: options => { queryOptions = options; return { data: { items: [], totalCount: 21 }, isFetching: fetching, error }; } },
  });
  const render = () => { react.reset(); return ProgramRetailerTable({ value, onChange: next => { value = next; }, disabled }); };
  let tree = render();
  assert.equal(nodes(tree, n => n.type === 'Modal').length, 0);
  const row = { id: 'r1', code: '1001', name: 'Shop', status: 'Active', phone: '0900000000' };
  let table = nodes(tree, n => n.type === 'DataTable')[0];
  table.props.columns[0].render(row).props.onChange({ target: { checked: true } });
  table.props.server.onPageChange(2); tree = render();
  assert.equal(queryOptions.queryKey.at(-3), 2);
  assert.deepEqual(value, [row]);
  const second = { ...row, id: 'r2', code: '1002' };
  table = nodes(tree, n => n.type === 'DataTable')[0];
  table.props.columns[0].render(second).props.onChange({ target: { checked: true } }); tree = render();
  table = nodes(tree, n => n.type === 'DataTable')[0];
  table.props.server.onSearchChange('milk'); tree = render();
  assert.equal(queryOptions.queryKey.at(-3), 1);
  assert.equal(queryOptions.queryKey.at(-2), 'milk');
  const checkbox = () => nodes(tree, n => n.type === 'DataTable')[0].props.columns[0].render(row);
  assert.equal(checkbox().props.checked, true);
  fetching = true; tree = render(); assert.equal(checkbox().props.disabled, true);
  fetching = false; error = new Error('offline'); tree = render(); assert.equal(checkbox().props.disabled, true);
  assert.deepEqual(value, [row, second]);
  nodes(tree, n => n.type === 'Checkbox')[0].props.onChange(true); tree = render();
  table = nodes(tree, n => n.type === 'DataTable')[0];
  assert.equal(queryOptions.enabled, false);
  assert.equal(table.props.server, undefined);
  assert.deepEqual(table.props.rows, [row, second]);
  table.props.columns[0].render(row).props.onChange({ target: { checked: false } }); tree = render();
  assert.deepEqual(value, [second]);
  disabled = true; tree = render(); assert.equal(checkbox().props.disabled, true);
  checkbox().props.onChange({ target: { checked: true } }); assert.deepEqual(value, [second]);
  error = undefined;
  nodes(tree, n => n.type === 'Checkbox')[0].props.onChange(false); tree = render();
  assert.equal(queryOptions.queryKey.at(-2), 'milk');
  assert.deepEqual(value, [second]);
});

test('create page validates audience and dates, preserves payload and stays open on backend failure', async () => {
  const react = hooks(); let sent; let closed = 0; let fail = true;
  const form = load('features/loyalty/programForm.ts', { '@/shared/api/errors': errors });
  const id = '11111111-1111-4111-8111-111111111111';
  const { ProgramCreateForm } = load('features/loyalty/components/ProgramCreateForm.tsx', {
    react, '@/shared/ui': ui, '@/shared/api/errors': errors,
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { role: 'Admin' } }) },
    '@/shared/auth/permissions': { assertPermission() {} }, '../programForm': form,
    './ProgramRetailerTable': { ProgramRetailerTable: 'Retailers' },
    '../hooks': { useCreateProgram: () => ({ isPending: false, mutateAsync: async payload => {
      sent = payload; if (fail) throw new errors.ApiError(409, 'Changed');
    } }) },
  });
  const render = () => { react.reset(); return ProgramCreateForm({ onClose: () => { closed++; } }); };
  let tree = render();
  const save = () => nodes(tree, n => n.type === 'Button' && n.props.children === 'Tạo chương trình')[0];
  await save().props.onClick(); tree = render(); assert.equal(sent, undefined);
  const fields = nodes(tree, n => n.type === 'FormField');
  for (const [label, value] of [['Tên chương trình', 'Program demo'], ['Số tiền quy đổi 1 điểm (VND)', '10000'], ['Điểm tối thiểu đổi quà', '0']]) {
    fields.find(n => n.props.label === label).props.children.props.onChange({ target: { value } });
  }
  const dates = nodes(tree, n => n.type === 'DateTimeInput');
  dates[0].props.onChange('2026-12-01T08:30'); dates[1].props.onChange('2026-12-31T20:00');
  nodes(tree, n => n.type === 'Retailers')[0].props.onChange([{ id, code: '1001', name: 'Shop', status: 'Active' }]);
  tree = render(); await save().props.onClick(); tree = render();
  assert.equal(closed, 0); assert.deepEqual(sent.retailerIds, [id]);
  assert.equal(sent.startAt, '2026-12-01T01:30:00.000Z');
  assert.equal(sent.endAt, '2026-12-31T13:00:00.000Z'); assert.equal(sent.pointsExpireAt, null);
  assert.ok(nodes(tree, n => n.type === 'Callout' && n.props.tone === 'danger').length);
  fail = false; await save().props.onClick(); assert.equal(closed, 1);
});
