const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

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

test('RoleDialog UI layout guarantees flexShrink: 0 and accordion toggle on screen groups with dedicated Mobile tab', () => {
  const roleTypes = source('features/roles/types.ts');
  assert.equal(roleTypes.WEB_SCREEN_GROUPS.length, 6, 'Should have 6 web screen groups');
  assert.equal(roleTypes.ALL_WEB_SCREEN_KEYS.length, 32, 'Should have 32 web screens');
  assert.equal(roleTypes.MOBILE_SCREEN_GROUPS.length, 3, 'Should have 3 mobile screen groups');
  assert.equal(roleTypes.ALL_MOBILE_SCREEN_KEYS.length, 23, 'Should have 23 mobile screens');
  assert.equal(roleTypes.ALL_SCREEN_KEYS.length, 55, 'Should have 55 total screens');

  const roleDialogSource = fs.readFileSync(path.resolve(__dirname, '../src/features/roles/components/RoleDialog.tsx'), 'utf8');

  // Verify flexShrink: 0 is present on the group card wrapper
  assert.ok(roleDialogSource.includes('flexShrink: 0'), 'Group card or items must have flexShrink: 0 to prevent collapsing');

  // Verify accordion controls are present
  assert.ok(roleDialogSource.includes('toggleExpandGroup'), 'Must support toggling group accordion');
  assert.ok(roleDialogSource.includes('Mở rộng tất cả'), 'Must have Expand All button');
  assert.ok(roleDialogSource.includes('Thu gọn tất cả'), 'Must have Collapse All button');
  assert.ok(roleDialogSource.includes('Tìm nhanh màn hình'), 'Must have search/filter box for screens');

  // Verify Web & Mobile tabs and platform scopes
  assert.ok(roleDialogSource.includes('Cổng Web'), 'Must have Web tab');
  assert.ok(roleDialogSource.includes('Ứng dụng Di động'), 'Must have Mobile tab');
  assert.ok(roleDialogSource.includes("activeTab === 'web'"), 'Must have conditional rendering for web tab');
  assert.ok(roleDialogSource.includes("activeTab === 'mobile'"), 'Must have conditional rendering for mobile tab');

  // Verify mock rendering of RoleDialog
  const { RoleDialog } = source('features/roles/components/RoleDialog.tsx', {
    '@/shared/ui': {
      Button: ({ children, ...props }) => React.createElement('button', props, children),
      FormField: ({ label, children }) => React.createElement('div', null, label, children),
      Input: (props) => React.createElement('input', props),
      Select: ({ options, ...props }) => React.createElement('select', props,
        options.map(option => React.createElement('option', { key: option.value, value: option.value }, option.label))),
      Modal: ({ children, title, subtitle, footer }) => React.createElement('div', { className: 'modal-mock' }, title, subtitle, children, footer),
      Tabs: ({ items, value, onChange }) => React.createElement('div', { className: 'tabs-mock' }),
    },
    'lucide-react': {
      Check: () => React.createElement('span', null, '✓'),
      Shield: () => React.createElement('span', null, '🛡'),
      Layers: () => React.createElement('span', null, '📑'),
      AlertCircle: () => React.createElement('span', null, '⚠'),
      ChevronDown: () => React.createElement('span', null, '▼'),
      ChevronRight: () => React.createElement('span', null, '▶'),
      Search: () => React.createElement('span', null, '🔍'),
      Smartphone: () => React.createElement('span', null, '📱'),
      Monitor: () => React.createElement('span', null, '🖥'),
    },
    '../types': roleTypes,
    '../api': { roleApi: {} },
  });

  const html = renderToStaticMarkup(React.createElement(RoleDialog, { onClose: () => {}, onSuccess: () => {} }));
  assert.ok(html.includes('Tạo vai trò mới'), 'Should render create title');
});

test('"Yêu cầu nhận hàng từ nhà máy" can be granted in Vai trò & phân quyền and is on by default for WarehouseKeeper', () => {
  const roleTypes = source('features/roles/types.ts');
  const screen = roleTypes.WEB_SCREEN_GROUPS.find(g => g.key === 'warehouse').screens.find(s => s.key === 'warehouse-factory-requests');
  assert.ok(screen, 'warehouse group lists the factory requests screen');
  assert.equal(screen.name, 'Yêu cầu nhận hàng từ nhà máy');
  assert.ok(roleTypes.DEFAULT_ROLE_PERMISSIONS.WarehouseKeeper.includes('warehouse-factory-requests'));
  assert.ok(roleTypes.DEFAULT_ROLE_PERMISSIONS.Admin.includes('warehouse-factory-requests'));
  const routes = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/app/routes.tsx'), 'utf8');
  assert.match(routes, /key: 'warehouse-factory-requests'/, 'permission key matches the route / sidebar key');
});
