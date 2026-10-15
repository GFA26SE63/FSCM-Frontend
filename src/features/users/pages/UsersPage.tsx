import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { formatDateTime, statusLabels } from '@/shared/lib';
import { roleLabel } from '@/shared/auth/roles';
import { useSetUserStatus, useUsers } from '../hooks';
import { UserDialog } from '../components/UserDialog';
import type { User } from '../types';

export function UsersPage() {
  const navigate = useNavigate();
  const query = useUsers();
  const setStatus = useSetUserStatus();
  const [creating, setCreating] = useState(false);
  const columns: Column<User>[] = [
    { key: 'name', header: 'Họ tên', width: '180px', render: (u) => <span className="strong">{u.name}</span> },
    { key: 'login', header: 'Tài khoản', text: (u) => u.loginName },
    { key: 'role', header: 'Vai trò', width: '150px', text: (u) => roleLabel[u.role] },
    { key: 'scope', header: 'Phạm vi', text: (u) => u.scope },
    { key: 'last', header: 'Đăng nhập gần nhất', width: '160px', text: (u) => formatDateTime(u.lastLoginAt) },
    { key: 'status', header: 'Trạng thái', width: '110px', render: (u) => <StatusChip domain="active" value={u.status} /> },
  ];
  return (
    <>
      <PageHeader title="Người dùng" subtitle="Portal: Admin, Operator, Warehouse Keeper, Sales Manager. App: Sales, Retailer. Admin không tạo được trên Portal." />
      <DataTable
        title="Danh sách tài khoản"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(u) => u.id}
        columns={columns}
        searchPlaceholder="Họ tên, tài khoản, phạm vi…"
        filters={[
          { label: 'Vai trò', options: Object.values(roleLabel), value: (u) => roleLabel[u.role] },
          { label: 'Trạng thái', options: [statusLabels.active.Active, statusLabels.active.Locked], value: (u) => statusLabels.active[u.status] },
        ]}
        actions={<Button variant="primary" onClick={() => setCreating(true)}>+ Tạo tài khoản</Button>}
        onRowClick={(u) => navigate(`/users/${encodeURIComponent(u.id)}`)}
        rowActionsWidth="170px"
        rowActions={(u) => (
          <>
            <Button size="sm" onClick={() => navigate(`/users/${encodeURIComponent(u.id)}`)}>Xem</Button>
            {u.role !== 'Admin' && <Button size="sm" variant={u.status === 'Active' ? 'danger' : 'primary'} onClick={() => setStatus.mutate({ id: u.id, status: u.status === 'Active' ? 'Locked' : 'Active' })}>{u.status === 'Active' ? 'Khóa' : 'Mở khóa'}</Button>}
          </>
        )}
      />
      <UserDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
