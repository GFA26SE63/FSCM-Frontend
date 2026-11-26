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
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...[node.props?.children, node.props?.actions, node.props?.footer].flat(Infinity).flatMap(child => nodes(child, predicate))];
}
const ui = Object.fromEntries(['ActionDropdown', 'Button', 'Callout', 'Card', 'Chip', 'DataTable', 'Fields', 'Modal', 'StatusChip'].map(key => [key, key]));

test('redemption dropdown retains lifecycle choices, permissions, pending protection and mutation payloads', () => {
  let role = 'Admin'; let pending = false; let failure;
  const calls = [];
  const { RedeemActions } = load('features/redeem/components/RedeemActions.tsx', {
    '@/shared/ui': ui, '@/shared/api/errors': { errorMessage: error => error.message },
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { role } }) },
    '@/shared/auth/permissions': { can: user => ['Admin', 'Operator'].includes(user.role) },
    '../hooks': { useRedeemStep: () => ({ isPending: pending, error: failure, mutate: value => calls.push(value) }) },
    '../policy': load('features/redeem/policy.ts'),
  });
  const render = status => RedeemActions({ x: { code: 'request', status }, dropdown: true });
  const menu = status => nodes(render(status), n => n.type === 'ActionDropdown')[0].props;
  for (const [status, keys] of [['Requested', ['approve', 'reject']], ['Approved', ['deliver', 'reject']], ['Delivered', ['complete']], ['Done', []], ['Rejected', []]]) {
    assert.deepEqual(menu(status).items.map(item => item.key), keys);
  }
  const approve = menu('Requested').items[0]; approve.onClick();
  assert.deepEqual(calls, [{ code: 'request', step: 'approve' }]);
  pending = true;
  const busy = menu('Requested');
  assert.equal(busy.showDisabledItems, true); assert.ok(busy.items.every(item => item.disabled));
  busy.items[0].onClick(); assert.equal(calls.length, 1);
  pending = false; role = 'Sales'; assert.equal(render('Requested'), null);
  role = 'Operator'; assert.equal(menu('Requested').items.length, 2);
  failure = new Error('Request failed'); assert.equal(nodes(render('Requested'), n => n.type === 'Callout').length, 1);
});

test('loyalty menus keep edit/status handlers and disabled expired activation; Operator gets view only', () => {
  let role = 'Admin'; let pending = false; const updates = [];
  const react = { useState: initial => [typeof initial === 'function' ? initial() : initial, value => updates.push(value)], useEffect() {} };
  const { LoyaltyProgramsPanel } = load('features/loyalty/components/LoyaltyProgramsPanel.tsx', {
    react, '@/shared/ui': ui,
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { role } }) },
    '@/shared/auth/permissions': { can: user => user.role === 'Admin' },
    '@/shared/api/errors': { errorMessage: String },
    '@/shared/router/compat': { useNavigate: () => () => {} },
    '@/shared/lib': { formatInstantDateTime: String, formatMoney: String, formatNumber: String },
    '../hooks': { usePrograms: () => ({}), useSetProgramActive: () => ({ isPending: pending, reset() {} }) },
    '../programForm': { programStatus: () => 'Status' }, './ProgramDialog': { ProgramDialog: 'Editor' },
  });
  const program = { id: 'p', code: 'LP', endAt: '2099-01-01T00:00:00Z', isActive: true };
  const actions = p => nodes(LoyaltyProgramsPanel(), n => n.type === 'DataTable')[0].props.rowActions(p);
  let tree = actions(program);
  assert.equal(typeof nodes(LoyaltyProgramsPanel(), n => n.type === 'DataTable')[0].props.onRowClick, 'function');
  const menu = nodes(tree, n => n.type === 'ActionDropdown')[0].props;
  assert.deepEqual(menu.items.map(item => item.key), ['edit', 'status']);
  menu.items[0].onClick(); assert.deepEqual(updates.at(-1), { program });
  menu.items[1].onClick(); assert.equal(updates.at(-1), program);
  tree = actions({ ...program, isActive: false, endAt: '2000-01-01T00:00:00Z' });
  const expired = nodes(tree, n => n.type === 'ActionDropdown')[0].props;
  assert.equal(expired.showDisabledItems, true);
  assert.equal(expired.items[1].label, 'Kích hoạt'); assert.equal(expired.items[1].disabled, true);
  pending = true; assert.equal(nodes(actions(program), n => n.type === 'ActionDropdown')[0].props.items[1].disabled, true);
  role = 'Operator';
  assert.equal(nodes(LoyaltyProgramsPanel(), n => n.type === 'DataTable')[0].props.rowActions, undefined);
});

test('dropdown can show disabled actions without allowing their handlers to run', t => {
  const original = global.document;
  global.document = { body: {} };
  t.after(() => { if (original === undefined) delete global.document; else global.document = original; });
  let calls = 0; let state;
  const { ActionDropdown } = load('shared/ui/ActionDropdown.tsx', {
    react: { useState: () => state++ === 0 ? [true, () => {}] : [{ top: 0, right: 0 }, () => {}], useRef: () => ({ current: null }), useEffect() {} },
    'react-dom': { createPortal: node => node },
  });
  const items = [{ key: 'a', label: 'Allowed', onClick: () => calls++ }, { key: 'd', label: 'Disabled', disabled: true, onClick: () => calls++ }];
  state = 0;
  assert.equal(nodes(ActionDropdown({ items }), n => n.props.role === 'menuitem').length, 1);
  state = 0;
  const buttons = nodes(ActionDropdown({ items, showDisabledItems: true }), n => n.props.role === 'menuitem');
  assert.equal(buttons.length, 2); assert.equal(buttons[1].props.disabled, true);
  buttons[1].props.onClick({ stopPropagation() {} }); assert.equal(calls, 0);
  buttons[0].props.onClick({ stopPropagation() {} }); assert.equal(calls, 1);
});

test('gift view is read-only and preserves image, description, program, zero stock and unknown redeemed total', () => {
  const { GiftDetailDialog } = load('features/gifts/components/GiftDetailDialog.tsx', {
    '@/shared/ui': ui, '@/shared/lib': { formatNumber: String },
  });
  const gift = { code: 'G1', name: 'Gift', loyaltyProgramId: 'lp', points: 50, stock: 0, redeemed: null, status: 'Paused', imageUrl: 'https://example.test/gift.png', description: 'Full description' };
  const tree = GiftDetailDialog({ gift, program: { code: 'LP', name: 'Program' }, onClose() {} });
  const fields = nodes(tree, n => n.type === 'Fields')[0].props.items;
  assert.equal(fields.find(f => f.label === 'Còn có thể cấp').value, '0');
  assert.equal(fields.find(f => f.label === 'Đã đổi').value, 'Chưa xác định');
  assert.equal(fields.find(f => f.label === 'Mô tả').value, 'Full description');
  assert.equal(fields.find(f => f.label === 'Chương trình khách hàng thân thiết').value, 'LP · Program');
  assert.equal(nodes(tree, n => n.type === 'img')[0].props.src, gift.imageUrl);
  assert.equal(nodes(tree, n => n.type === 'Input').length, 0);
});
