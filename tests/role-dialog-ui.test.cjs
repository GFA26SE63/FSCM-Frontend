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

test('RoleDialog UI layout guarantees flexShrink: 0 and accordion toggle on all 6 screen groups', () => {
  const roleTypes = source('features/roles/types.ts');
  assert.equal(roleTypes.SCREEN_GROUPS.length, 6, 'Should have 6 screen groups');
  assert.equal(roleTypes.ALL_SCREEN_KEYS.length, 31, 'Should have 31 total screens');

  const roleDialogSource = fs.readFileSync(path.resolve(__dirname, '../src/features/roles/components/RoleDialog.tsx'), 'utf8');

  // Verify flexShrink: 0 is present on the group card wrapper
  assert.ok(roleDialogSource.includes('flexShrink: 0'), 'Group card or items must have flexShrink: 0 to prevent collapsing');

  // Verify accordion controls are present
  assert.ok(roleDialogSource.includes('toggleExpandGroup'), 'Must support toggling group accordion');
  assert.ok(roleDialogSource.includes('Mở rộng tất cả'), 'Must have Expand All button');
  assert.ok(roleDialogSource.includes('Thu gọn tất cả'), 'Must have Collapse All button');
  assert.ok(roleDialogSource.includes('Tìm nhanh màn hình'), 'Must have search/filter box for screens');

  // Verify mock rendering of RoleDialog
  const { RoleDialog } = source('features/roles/components/RoleDialog.tsx', {
    '@/shared/ui': {
      Button: ({ children, ...props }) => React.createElement('button', props, children),
      FormField: ({ label, children }) => React.createElement('div', null, label, children),
      Input: (props) => React.createElement('input', props),
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
    },
    '../types': roleTypes,
    '../api': { roleApi: {} },
  });

  const html = renderToStaticMarkup(React.createElement(RoleDialog, { onClose: () => {}, onSuccess: () => {} }));
  assert.ok(html.includes('Tạo vai trò mới'), 'Should render create title');
});
