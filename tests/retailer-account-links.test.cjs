const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const retailerDetail = fs.readFileSync(
  path.resolve(__dirname, '../src/features/retailers/pages/RetailerDetailPage.tsx'),
  'utf8',
);
const userDetail = fs.readFileSync(
  path.resolve(__dirname, '../src/features/users/pages/UserDetailPage.tsx'),
  'utf8',
);

test('retailer and retailer account details link to one another using canonical identifiers', () => {
  assert.ok(retailerDetail.includes('r.userAccountId'));
  assert.ok(retailerDetail.includes('navigate(`/users/${r.userAccountId}`)'));
  assert.ok(userDetail.includes("user.role === 'Retailer'"));
  assert.ok(userDetail.includes('navigate(`/retailers/${retailerId}`)'));
});
