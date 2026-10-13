import { useParams } from 'react-router-dom';
import { Button, Card, Fields, PageHeader, QueryState, StatusChip } from '@/shared/ui';
import { formatDateTime } from '@/shared/lib';
import { roleLabel } from '@/shared/auth/roles';
import { useSetUserStatus, useUser } from '../hooks';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const query = useUser(id);
  const setStatus = useSetUserStatus();
  return (
    <QueryState query={query}>
      {(u) => (
        <>
          <PageHeader
            back="/users"
            title={u.name}
            subtitle={u.loginName}
            chips={<StatusChip domain="active" value={u.status} />}
            actions={u.role !== 'Admin' ? <Button variant={u.status === 'Active' ? 'danger' : 'primary'} loading={setStatus.isPending} onClick={() => setStatus.mutate({ id: u.id, status: u.status === 'Active' ? 'Locked' : 'Active' })}>{u.status === 'Active' ? 'Khóa tài khoản' : 'Mở khóa'}</Button> : undefined}
          />
          <Card>
            <Fields cols={3} items={[
              { label: 'Họ tên', value: u.name }, { label: 'Tài khoản', value: u.loginName }, { label: 'Vai trò', value: roleLabel[u.role] },
              { label: 'Phạm vi', value: u.scope }, { label: 'Đăng nhập gần nhất', value: formatDateTime(u.lastLoginAt) },
            ]} />
          </Card>
        </>
      )}
    </QueryState>
  );
}
