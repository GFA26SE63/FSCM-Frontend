'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const gql = read('src/features/notifications/notificationsGraphql.ts');
const bell = read('src/features/notifications/components/NotificationBell.tsx');
const api = read('src/features/notifications/api.ts');
const page = read('src/features/notifications/NotificationsPage.tsx');
const routes = read('src/app/routes.tsx');
const sidebar = read('src/app/layout/Sidebar.tsx');
const guards = read('src/shared/auth/guards.tsx');

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
test('all Portal roles get a personal notification history, even when feature grants are customized', () => {
  assert.ok(routes.includes("key: 'notifications'") && routes.includes('availableToAllPortalUsers: true'));
  assert.ok(sidebar.includes('r.availableToAllPortalUsers') && sidebar.includes('isPortalRole(user.role)'));
  assert.ok(guards.includes('allowAllPortalRoles') && guards.includes('isPortalRole(user.role)'));
});
test('notification history preserves recipient scope, read controls, retry and deep-link navigation', () => {
  assert.ok(page.includes('Personal notification history') && page.includes('never accepts a recipient id'));
  assert.ok(page.includes('Đánh dấu tất cả đã đọc') && page.includes("tab === 'unread'"));
  assert.ok(page.includes('notifications.refetch()') && page.includes('portalLink(notification.deepLink)'));
  assert.ok(bell.includes("navigate('/notifications')"));
});
