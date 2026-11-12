const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', 'module', code)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) throw new Error('Missing mock: ' + name);
    return require(name);
  }, mod.exports, mod);
  return mod.exports;
}

const profile = source('features/retailers/profileForm.ts');
const initial = {
  name: 'Store', contactName: 'Contact', phone: '0909888777', email: 'contact@example.com',
  address: 'Address', retailerType: 'GroceryStore', forecastRevenue: '40000000', storeSizeSquareMeters: '45',
  purchasingCapacity: '80', purchaseFrequencyPerMonth: '4', creditTermDays: '14', assessmentNote: '',
  lat: '10.8', lng: '106.7',
};

test('unchanged values, equivalent number formatting and trimmed text are not profile changes', () => {
  assert.equal(profile.hasRetailerProfileChanges(initial, { ...initial }), false);
  assert.equal(profile.hasRetailerProfileChanges(initial, {
    ...initial, name: ' Store ', email: ' CONTACT@EXAMPLE.COM ', forecastRevenue: 40000000,
    lat: '10.8000', lng: 106.7, assessmentNote: '   ',
  }), false);
  assert.equal(profile.hasRetailerProfileChanges(initial, { ...initial, status: 'Active', code: '10000001', groupCode: 'other' }), false);
  const edited = { ...initial, name: 'New name' };
  assert.equal(profile.hasRetailerProfileChanges(initial, edited), true);
  edited.name = initial.name;
  assert.equal(profile.hasRetailerProfileChanges(initial, edited), false);
});

test('every editable profile field participates in the comparison, including map coordinates', () => {
  const changes = {
    name: 'Other store', contactName: 'Other contact', phone: '0909888778', email: 'other@example.com',
    address: 'Other address', retailerType: 'MarketStall', forecastRevenue: 1, storeSizeSquareMeters: 46,
    purchasingCapacity: 81, purchaseFrequencyPerMonth: 0, creditTermDays: '30', assessmentNote: 'Note',
    lat: 10.81, lng: 106.71,
  };
  for (const [key, value] of Object.entries(changes)) {
    assert.equal(profile.hasRetailerProfileChanges(initial, { ...initial, [key]: value }), true, key);
  }
});

test('unchanged submit shows information without calling mutation or closing; changed submit saves normally', async () => {
  const saves = [];
  const notices = [];
  let closed = 0;
  const { RetailerFormDialog } = source('features/retailers/components/RetailerFormDialog.tsx', {
    '@/shared/ui': { FormDialog() {}, Modal() {}, AddressLocationPicker() {}, useToast: () => ({ show: message => notices.push(message) }) },
    '@/shared/lib': { IdFormat: {} },
    '../profileForm': profile,
    '../hooks': {
      useRetailerLookups: () => ({ areas: { data: [] }, groups: { data: [] } }),
      useCreateRetailer: () => ({ mutateAsync: async () => { throw new Error('Must not create'); } }),
      useUpdateRetailerProfile: () => ({ mutateAsync: async input => saves.push(input) }),
    },
  });
  const retailer = {
    id: 'retailer-id', code: '10004127', name: initial.name, contactName: initial.contactName,
    phone: initial.phone, email: initial.email, address: initial.address, retailerType: initial.retailerType,
    forecastRevenue: 40000000, storeSizeSquareMeters: 45, purchasingCapacity: 80,
    purchaseFrequencyPerMonth: 4, creditTermDays: 14, latitude: 10.8, longitude: 106.7, status: 'Active',
  };
  const form = RetailerFormDialog({ open: true, retailer, onClose: () => { closed += 1; } }).props;
  await form.onSubmit({ ...form.initial });
  assert.deepEqual(notices, ['Chưa có thay đổi nào.']);
  assert.equal(saves.length, 0);
  assert.equal(closed, 0);
  await form.onSubmit({ ...form.initial, name: 'Updated store' });
  assert.equal(saves.length, 1);
  assert.equal(saves[0].payload.name, 'Updated store');
  assert.equal(saves[0].retailerId, 'retailer-id');
  assert.equal(closed, 1);
});
