const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = (...parts) => fs.readFileSync(path.resolve(__dirname, '..', 'src', 'features', ...parts), 'utf8');

test('custom operational lists provide real Excel exports', () => {
  for (const source of [
    page('warehouse-work', 'index.tsx'),
    page('batchpromo', 'pages', 'BatchPromoPage.tsx'),
    page('gifts', 'pages', 'GiftsPage.tsx'),
    page('categories', 'pages', 'CategoriesPage.tsx'),
  ]) {
    assert.match(source, /downloadExcel\(/);
    assert.match(source, /Xuất Excel/);
  }
});

test('refund obligation export is in the card header, not joined to the table', () => {
  const source = page('refunds', 'pages', 'RefundsPage.tsx');
  assert.match(source, /title=\{<div><h2 className="sec"/);
  assert.ok(source.includes('actions={<Button'));
  assert.ok(source.includes('exportObligations()}>Xuất Excel</Button>}'));
  assert.match(source, /excelFileName=""/);
});

test('batches relies on the single shared DataTable Excel control', () => {
  const source = page('batches', 'pages', 'BatchesPage.tsx');
  assert.doesNotMatch(source, /handleExportExcel/);
  assert.doesNotMatch(source, /actions=\{\s*<Button[^>]*>\s*Xuất Excel/);
});
