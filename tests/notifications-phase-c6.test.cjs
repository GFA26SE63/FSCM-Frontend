'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const gql = read('src/features/notifications/notificationsGraphql.ts');
const bell = read('src/features/notifications/components/NotificationBell.tsx');
const api = read('src/features/notifications/api.ts');

test('newest-first with id tiebreaker, literal first, unread filter and totalCount', () => {
  assert.ok(gql.includes('order: [{ createdAt: DESC }, { id: DESC }]'));
  assert.ok(gql.includes('first: ${limit}') && gql.includes('where: { isRead: { eq: false } }'));
  assert.ok((gql.match(/totalCount/g) || []).length >= 2);
});
test('no recipient/user filter is sent from the client (server scopes to the signed-in user)', () => {
  assert.ok(!/userAccountId\s*:\s*\{/.test(gql.replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.ok(gql.includes('UserAccountId == authenticated user'));
});
test('bell uses server counts, no client-side unread filtering of a full dataset', () => {
  assert.ok(bell.includes('data?.unread.totalCount') && bell.includes('Xem thêm'));
  assert.ok(!bell.includes('data.filter('));
});
test('mark-read, mark-all-read and badges stay REST', () => {
  assert.ok(api.includes("patch<AppNotification>(`/notifications/${id}/read`)"));
  assert.ok(api.includes("'/notifications/read-all'") && api.includes("'/notifications/badges'"));
});
test('limit is validated (bounded window)', () => {
  assert.ok(gql.includes("throw new Error('invalid limit')") && gql.includes('NOTIFICATIONS_MAX_LIMIT'));
});
