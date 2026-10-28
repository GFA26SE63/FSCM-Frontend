import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import {
  Button,
  DataTable,
  PageHeader,
  Select,
  type Column,
} from '@/shared/ui';
import { formatDateTime } from '@/shared/lib';
import { roleLabel } from '@/shared/auth/roles';
import { useAuth } from '@/shared/auth/AuthContext';
import { useUsers } from '../hooks';
import { UserDialog } from '../components/UserDialog';
import { UserStatusButton } from '../components/UserStatusButton';
import type { User, UserFilters } from '../types';

const initialFilters: UserFilters = {
  search: '',
  role: '',
  activity: '',
  page: 1,
  pageSize: 20,
};

export function UsersPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] =
    useState<UserFilters>(initialFilters);
  const query = useUsers(filters);

  const columns: Column<User>[] = [
    {
      key: 'fullName',
      header: 'Họ tên',
      text: (user) => user.fullName,
    },
    {
      key: 'email',
      header: 'Email',
      text: (user) => user.email,
    },
    {
      key: 'role',
      header: 'Vai trò',
      text: (user) => roleLabel[user.role],
    },
    {
      key: 'provider',
      header: 'Đăng nhập ban đầu',
      text: (user) =>
        user.identityProvider === 'Entra'
          ? 'Microsoft Entra'
          : 'Email / mật khẩu',
    },
    {
      key: 'active',
      header: 'Trạng thái',
      text: (user) =>
        user.isActive
          ? 'Hoạt động'
          : 'Không hoạt động',
    },
    {
      key: 'created',
      header: 'Ngày tạo',
      text: (user) => formatDateTime(user.createdAt),
    },
  ];

  return (
    <>
      <PageHeader
        title="Người dùng"
        subtitle="Quản lý tài khoản và assignment theo vai trò."
      />

      <DataTable
        title="Danh sách tài khoản"
        columns={columns}
        rows={query.data?.items}
        loading={query.isLoading}
        error={query.error}
        rowKey={(user) => user.id}
        searchPlaceholder="Họ tên hoặc email…"
        server={{
          page: filters.page,
          size: filters.pageSize,
          total: query.data?.totalCount ?? 0,
          search: filters.search,

          onPageChange: (page) =>
            setFilters((current) => ({
              ...current,
              page,
            })),

          onSearchChange: (search) =>
            setFilters((current) => ({
              ...current,
              search,
              page: 1,
            })),
        }}
        filterExtra={
          <>
            <label className="lbl">
              Vai trò
              <Select
                value={filters.role}
                options={[
                  { value: '', label: 'Tất cả' },
                  ...Object.entries(roleLabel).map(
                    ([value, label]) => ({
                      value,
                      label,
                    }),
                  ),
                ]}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    role: event.target.value,
                    page: 1,
                  }))
                }
              />
            </label>

            <label className="lbl">
              Trạng thái
              <Select
                value={filters.activity}
                options={[
                  { value: '', label: 'Tất cả' },
                  {
                    value: 'active',
                    label: 'Hoạt động',
                  },
                  {
                    value: 'inactive',
                    label: 'Không hoạt động',
                  },
                ]}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    activity:
                      event.target.value as UserFilters['activity'],
                    page: 1,
                  }))
                }
              />
            </label>

            <Button
              onClick={() =>
                setFilters({ ...initialFilters })
              }
            >
              Đặt lại tất cả
            </Button>
          </>
        }
        actions={
          auth.user?.role === 'Admin' && (
            <Button
              variant="primary"
              onClick={() => setCreating(true)}
            >
              + Tạo tài khoản
            </Button>
          )
        }
        onRowClick={(user) =>
          navigate(
            `/users/${encodeURIComponent(user.id)}`,
          )
        }
        rowActionsWidth="180px"
        rowActions={(user) => (
          <>
            <Button
              size="sm"
              onClick={() =>
                navigate(
                  `/users/${encodeURIComponent(user.id)}`,
                )
              }
            >
              Xem
            </Button>

            <UserStatusButton user={user} />
          </>
        )}
      />

      {creating && (
        <UserDialog
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}