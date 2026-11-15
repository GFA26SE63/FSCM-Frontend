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

const KEEPER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';
const NO_NAME_ID = '44444444-4444-4444-8444-444444444444';

/** Runs the hook as a plain function with controllable query results. */
function setup({ role, me, keepers = [], users = {}, warehousesPending = false, userPending = [] }) {
  const requested = [];
  const mod = source('features/receipts/userNames.ts', {
    react: { useMemo: (fn) => fn() },
    '@tanstack/react-query': {
      useQuery: () => ({ isPending: warehousesPending, data: warehousesPending ? undefined : [{ keepers }] }),
      useQueries: ({ queries }) => queries.map((q) => {
        requested.push(q.queryKey);
        const id = q.queryKey[2];
        if (userPending.includes(id)) return { isPending: true };
        return users[id] ? { isPending: false, data: users[id] } : { isPending: false, isError: true };
      }),
    },
    '@/shared/auth/AuthContext': { useAuth: () => ({ user: { ...me, role } }) },
    '@/shared/auth/permissions': { can: (u, perm) => perm === 'users.manage' && u.role === 'Admin' },
    '@/features/users/api': { userApi: {} },
    './api': { receiptApi: {} },
  });
  return { mod, requested };
}

const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-/i;

test('Admin: full name from the users API; each distinct ID requested once; never a raw ID', () => {
  const { mod, requested } = setup({
    role: 'Admin',
    me: { id: ADMIN_ID, name: 'Quản trị FSCM', email: 'admin@example.test' },
    keepers: [{ userId: KEEPER_ID, fullName: 'Thủ kho Một', email: 'k1@example.test' }],
    users: { [OTHER_ID.toLowerCase()]: { fullName: 'Nhân viên Hai', email: 'nv2@example.test' } },
  });
  const ids = [KEEPER_ID, KEEPER_ID, OTHER_ID, OTHER_ID.toUpperCase(), ADMIN_ID];
  const { nameOf } = mod.useReceiptUserNames(ids);
  assert.equal(nameOf(KEEPER_ID), 'Thủ kho Một');
  assert.equal(nameOf(ADMIN_ID), 'Quản trị FSCM');
  assert.equal(nameOf(OTHER_ID), 'Nhân viên Hai');
  // Only the one ID without a local name hits /users, once despite duplicates / casing.
  assert.deepEqual(requested.map((k) => k[2]), [OTHER_ID.toLowerCase()]);
  for (const id of ids) assert.doesNotMatch(nameOf(id), uuid);
});

test('account name is used when the full name is missing; unresolvable → "Không xác định"', () => {
  const { mod } = setup({
    role: 'Admin',
    me: { id: ADMIN_ID, name: 'Quản trị', email: 'admin@example.test' },
    users: { [NO_NAME_ID]: { fullName: '', email: 'chi-email@example.test' } },
  });
  const { nameOf } = mod.useReceiptUserNames([NO_NAME_ID, OTHER_ID]);
  assert.equal(nameOf(NO_NAME_ID), 'chi-email@example.test');
  assert.equal(nameOf(OTHER_ID), 'Không xác định'); // 403/404 from the users API
});

test('Warehouse Keeper never calls the users API (no permission) and unknown approvers show "Không xác định"', () => {
  const { mod, requested } = setup({
    role: 'WarehouseKeeper',
    me: { id: KEEPER_ID, name: 'Thủ kho FSCM', email: 'keeper@example.test' },
  });
  const { nameOf, approverOf } = mod.useReceiptUserNames([KEEPER_ID, ADMIN_ID]);
  assert.equal(requested.length, 0);
  assert.equal(nameOf(KEEPER_ID), 'Thủ kho FSCM');
  assert.equal(approverOf({ approvedByUserId: ADMIN_ID, approvedAt: '2026-11-10T00:00:00Z', status: 'Received' }), 'Không xác định');
});

test('approval: pending → "Chưa duyệt"; approved without approver info → "Không xác định" (not "Chưa duyệt")', () => {
  const { mod } = setup({ role: 'Admin', me: { id: ADMIN_ID, name: 'Quản trị', email: 'a@example.test' } });
  const { approverOf } = mod.useReceiptUserNames([]);
  assert.equal(approverOf({ approvedByUserId: null, approvedAt: null, status: 'Pending' }), 'Chưa duyệt');
  assert.equal(approverOf({ approvedByUserId: null, approvedAt: '2026-11-10T00:00:00Z', status: 'Received' }), 'Không xác định');
  assert.equal(approverOf({ approvedByUserId: ADMIN_ID, approvedAt: '2026-11-10T00:00:00Z', status: 'Received' }), 'Quản trị');
});

test('while names are loading a neutral placeholder is shown, never the ID', () => {
  const { mod } = setup({ role: 'Admin', me: { id: ADMIN_ID, name: 'Quản trị', email: 'a@example.test' }, warehousesPending: true });
  assert.equal(mod.useReceiptUserNames([OTHER_ID]).nameOf(OTHER_ID), '…');
  const s2 = setup({ role: 'Admin', me: { id: ADMIN_ID, name: 'Quản trị', email: 'a@example.test' }, userPending: [OTHER_ID] });
  assert.equal(s2.mod.useReceiptUserNames([OTHER_ID]).nameOf(OTHER_ID), '…');
});
