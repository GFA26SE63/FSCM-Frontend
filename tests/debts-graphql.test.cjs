const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('debt list uses the typed GraphQL receivables contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/features/debts/api.ts'),
    'utf8',
  );

  assert.match(source, /graphql<\{ receivables: Receivable\[\] \}>/);
  assert.match(source, /query Receivables/);
  assert.doesNotMatch(source, /get<Receivable\[]>\('\/receivables'/);
});
