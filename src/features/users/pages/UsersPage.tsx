import { useMemo, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { parsePage, useQueryParams } from '@/shared/router/listState';
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

const PAGE_SIZE = 20;
const ACTIVITIES: UserFilters['activity'][] = ['active', 'inactive'];

/** Bộ lọc danh sách tài khoản lấy từ URL (giá trị lạ → mặc định). */
function useUserFilters() {
  const { params, setParams } = useQueryParams();
  const search = params.get('q') ?? '';
  const rawRole = params.get('role') ?? '';
  const rawActivity = params.get('activity') ?? '';
  const page = parsePage(params.get('page'));
  const filters = useMemo<UserFilters>(
    () => ({
      search,
      role: rawRole in roleLabel ? rawRole : '',
      activity: (ACTIVITIES as string[]).includes(rawActivity) ? (rawActivity as UserFilters['activity']) : '',
      page,
      pageSize: PAGE_SIZE,
    }),
    [search, rawRole, rawActivity, page],
  );
  return { filters, setParams };
}

export function UsersPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [creating, setCreating] = useState(false);
  const { filters, setParams } = useUserFilters();
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
      key: 'phone',
      header: 'Số điện thoại',
      text: (user) => user.phone || '—',
    },
    {
      key: 'role',
      header: 'Vai trò',
      text: (user) => roleLabel[user.role],
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
            setParams({ page: page > 1 ? page : null }),

          onSearchChange: (search) =>
            setParams({ q: search, page: null }),
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
                  setParams({ role: event.target.value, page: null })
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
                  setParams({ activity: event.target.value, page: null })
                }
              />
            </label>

            <Button
              onClick={() =>
                setParams({ q: null, role: null, activity: null, page: null })
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
