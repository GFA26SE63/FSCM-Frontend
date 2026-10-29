import { db } from '../fixtures';
import type { DbUser } from '../fixtures/types';
import { MockHttpError, MockRouter, businessRule, notFound, paginate, validation } from '../router';
import { actor, encodeToken } from './common';
import { MOCK_NOW } from '../engines/clock';

/** Demo accounts of the four portal roles (names from the prototype). Mirrors shared/auth/roles.ts without importing it. */
const DEMO: Record<string, { email: string; name: string }> = {
  Admin: { email: 'khoa.pm@fscm.local', name: 'Phạm Minh Khoa' },
  Operator: { email: 'trang.lt@fscm.local', name: 'Lý Thu Trang' },
  WarehouseKeeper: { email: 'tam.dv@fscm.local', name: 'Đỗ Văn Tâm' },
  SalesManager: { email: 'bao.hg@fscm.local', name: 'Hồ Gia Bảo' },
};
const ROLES = ['Admin', 'Operator', 'SalesManager', 'WarehouseKeeper', 'Sales', 'Retailer'];

const userDto = (u: DbUser) => ({
  ...u,
  email: u.loginName,
  fullName: u.name,
  isActive: u.status === 'Active',
  identityProvider: 'Local',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  mustChangePassword: false,
  scope: {
    warehouseIds: [],
    regionIds: [],
    salesGroupIds: [],
    retailerIds: [],
  },
});

export function registerIdentity(r: MockRouter) {
  r.post('/auth/mock-token', ({ body }) => {
    const { email, password, role } = body ?? {};
    if (!password || String(password).length < 6) throw validation({ password: ['Mật khẩu tối thiểu 6 ký tự.'] });
    const pick = role && DEMO[role] ? role : Object.keys(DEMO).find((k) => DEMO[k].email === String(email).toLowerCase());
    if (!pick) throw new MockHttpError(401, 'Sai email hoặc mật khẩu', 'Mock chấp nhận 4 tài khoản demo: khoa.pm@, trang.lt@, tam.dv@, bao.hg@fscm.local.');
    return { accessToken: encodeToken({ role: pick, email: DEMO[pick].email, name: DEMO[pick].name }) };
  });

  r.get('/me', (req) => {
    const a = actor(req);
    return {
      id: a.email, name: a.name, email: a.email, role: a.role,
      warehouseCode: a.role === 'WarehouseKeeper' ? 'WH-TA' : null,
      areaCodes: a.role === 'SalesManager' ? db.areas.map((x) => x.code) : [],
    };
  });

  r.get('/users', ({ query }) => paginate(db.users.map(userDto), query, (u) => `${u.name} ${u.loginName} ${u.role} ${u.scope}`));

  r.post('/users', ({ body }) => {
    const { name, role, phone, email, warehouseCode, groupCode, retailerCode } = body ?? {};
    if (role === 'Admin') throw businessRule('Không tạo tài khoản Admin trên Portal – Admin được tạo sẵn khi cài đặt hệ thống.', 'admin_not_creatable');
    if (!ROLES.includes(role)) throw validation({ role: ['Role không hợp lệ.'] });
    const portal = role === 'Operator' || role === 'SalesManager';
    const loginName = portal ? email : phone;
    if (!name) throw validation({ name: ['Bắt buộc nhập.'] });
    if (!loginName) throw validation({ [portal ? 'email' : 'phone']: ['Bắt buộc nhập.'] });
    if (db.users.some((u) => u.loginName === loginName)) throw validation({ [portal ? 'email' : 'phone']: ['Tài khoản đã tồn tại.'] });
    const scope =
      role === 'WarehouseKeeper' ? db.warehouses.find((w) => w.code === warehouseCode)?.name ?? '—'
      : role === 'Sales' ? groupCode ?? '—'
      : role === 'Retailer' ? retailerCode ?? '—'
      : role === 'SalesManager' ? db.areas.map((a) => a.name).join(', ')
      : '—';
    const user: DbUser = { id: loginName, name, loginName, role, scope, status: 'Active', lastLoginAt: null };
    db.users.push(user);
    if (role === 'Sales' && groupCode) db.groups.find((g) => g.code === groupCode)?.members.push(name);
    return userDto(user);
  });

  r.put('/users/:id', ({ params, body }) => {
    const u = db.users.find((x) => x.id === params.id) ?? (() => { throw notFound(`Tài khoản ${params.id}`); })();
    if (body?.status) u.status = body.status;
    if (body?.name) u.name = body.name;
    return userDto(u);
  });

  r.get('/users/:id', ({ params }) => userDto(db.users.find((x) => x.id === params.id) ?? (() => { throw notFound(`Tài khoản ${params.id}`); })()));
  r.post('/devices', () => undefined);

  // ---- notifications module (kept here: tiny, and needs the same token decoding) ----
  r.get('/notifications', ({ query }) => paginate([...db.notifications].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), query));
  r.post('/notifications/:id/read', ({ params }) => {
    const n = db.notifications.find((x) => x.id === params.id);
    if (n) n.read = true;
    return undefined;
  });
  r.get('/notifications/badges', () => ({
    orders: db.orders.filter((o) => o.status === 'Pending').length,
    debts: db.orders.filter((o) => o.paymentMethod === 'Credit' && o.credit?.deliveredAt && !o.credit.paid && o.credit.dueDate && o.credit.dueDate < MOCK_NOW.slice(0, 10)).length,
    retailers: db.registrations.filter((x) => x.status === 'Pending').length,
    redeem: db.redemptions.filter((x) => x.status === 'Requested').length,
    complaints: db.complaints.filter((x) => x.status === 'Open').length,
    disposal: db.batches.filter((b) => !b.disposed && b.available + b.held > 0 && b.expiry <= MOCK_NOW.slice(0, 10)).length,
  }));
}
