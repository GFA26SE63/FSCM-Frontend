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
import { can } from '@/shared/auth/permissions';
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
  const requestedSize = Number(params.get('size'));
  const pageSize = [10, 20, 50].includes(requestedSize) ? requestedSize : PAGE_SIZE;
  const sort = params.get('sort') === 'asc' ? 'asc' : 'desc';
  const filters = useMemo<UserFilters>(
    () => ({
      search,
      role: rawRole ?? '',
      activity: (ACTIVITIES as string[]).includes(rawActivity) ? (rawActivity as UserFilters['activity']) : '',
      page,
      pageSize,
      sort,
    }),
    [search, rawRole, rawActivity, page, pageSize, sort],
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
      text: (user) => roleLabel[user.role] ?? user.role,
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
        subtitle="Quản lý tài khoản và phân quyền vai trò cho nhân sự."
        actions={
          (auth.user?.role === 'Admin' || auth.user?.permissions?.includes('roles')) && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="ghost"
                onClick={() => navigate('/roles')}
              >
                Vai trò & phân quyền
              </Button>
              <Button
                variant="primary"
                onClick={() => setCreating(true)}
              >
                + Tạo tài khoản
              </Button>
            </div>
          )
        }
      />

      <DataTable
        title="Danh sách tài khoản"
        nowrap
        columns={columns}
        summaryColumns={['fullName', 'email', 'phone', 'role', 'active', 'created']}
        rows={query.data?.items}
        loading={query.isLoading}
        error={query.error}
        rowKey={(user) => user.id}
        searchPlaceholder="Họ tên hoặc email…"
        server={{
          page: filters.page,
          size: filters.pageSize,
          total: query.data?.totalCount ?? 0,
          onPageSizeChange: size => setParams({ size, page: null }),
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
            <label className="lbl">Ngày tạo<Select value={filters.sort} options={[{ value: 'desc', label: 'Mới nhất' }, { value: 'asc', label: 'Cũ nhất' }]} onChange={event => setParams({ sort: event.target.value === 'asc' ? 'asc' : null, page: null })} /></label>

            <Button
              onClick={() =>
                setParams({ q: null, role: null, activity: null, sort: null, page: null })
              }
            >
              Đặt lại tất cả
            </Button>
          </>
        }
        actions={
          can(auth.user, 'users.create') && (
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
        rowActionsWidth="120px"
        rowActions={(user) => <UserStatusButton user={user} />}
      />

      {creating && (
        <UserDialog
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}
