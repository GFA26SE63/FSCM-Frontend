const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/shared/lib/dates.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function('exports', code)(mod.exports);
const dates = mod.exports;

test('UTC and explicit offsets display the same Vietnam time, including a day/year rollover', () => {
  assert.equal(dates.formatDateTime('2026-11-14T03:04:00Z'), '14/11/2026 10:04');
  assert.equal(dates.formatDateTime('2026-11-14T10:04:00+07:00'), '14/11/2026 10:04');
  assert.equal(dates.formatDateTime('2026-11-13T22:04:00-05:00'), '14/11/2026 10:04');
  assert.equal(dates.formatShortDateTime('2026-12-31T17:00:00Z'), '01/01 00:00');
  assert.equal(dates.formatDate('2026-12-31T17:00:00Z'), '01/01/2027');
  assert.equal(dates.formatDayMonth('2026-12-31T17:00:00Z'), '01/01');
});

test('DateOnly, calendar arithmetic and missing dates keep their existing meaning', () => {
  assert.equal(dates.formatDate('2026-11-14'), '14/11/2026');
  assert.equal(dates.formatInstantDate('2026-11-14'), '14/11/2026');
  assert.equal(dates.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(dates.daysBetween('2026-11-14', '2026-11-15'), 1);
  assert.equal(dates.formatDateTime(null), '—');
  assert.equal(dates.formatShortDateTime('0001-01-01T00:00:00Z'), '—');
});

test('Vietnam inputs round-trip to UTC without changing seconds or milliseconds', () => {
  const original = '2026-11-13T17:02:03.456Z';
  assert.equal(dates.toVietnamDateTimeInput(original), '2026-11-14T00:02:03.456');
  assert.equal(dates.vietnamDateTimeToIso('2026-11-14T00:02:03.456'), original);
  assert.equal(dates.toIsoDateTime(new Date(original)), '2026-11-14T00:02');
  assert.equal(dates.vietnamDateTimeToIso('2026-11-14T00:02'), '2026-11-13T17:02:00.000Z');
  assert.equal(dates.formatDateTime('2026-11-14T00:02'), '14/11/2026 00:02');
  for (const value of ['', '2026-02-30T10:00', '2026-11-14T24:00', '2026-11-14T10:00Z']) {
    assert.throws(() => dates.vietnamDateTimeToIso(value));
  }
});

test('display, date filters and refund input do not depend on the device timezone', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['UTC', 'America/New_York', 'Asia/Ho_Chi_Minh']) {
      process.env.TZ = zone;
      const instant = new Date('2026-11-13T18:05:00Z');
      assert.equal(dates.formatDateTime(instant.toISOString()), '14/11/2026 01:05');
      assert.equal(dates.vietnamDate(instant), '2026-11-14');
      assert.equal(dates.toIsoDateTime(instant), '2026-11-14T01:05');
      assert.equal(dates.vietnamDateTimeToIso('2026-11-14T01:05'), '2026-11-13T18:05:00.000Z');
      assert.equal(dates.formatDate('2026-11-14'), '14/11/2026');
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
