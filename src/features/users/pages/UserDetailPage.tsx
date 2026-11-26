import { useState } from 'react';
import { useNavigate, useParams } from '@/shared/router/compat';
import {
  Button,
  Card,
  Fields,
  PageHeader,
  QueryState,
} from '@/shared/ui';
import { roleLabel } from '@/shared/auth/roles';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useUser } from '../hooks';
import { UserDialog } from '../components/UserDialog';
import { RoleAssignmentDialog } from '../components/RoleAssignmentDialog';
import { AssignmentPicker } from '../components/AssignmentPicker';
import { UserAuditPanel } from '../components/UserAuditPanel';
import type { ScopeKind } from '../types';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const query = useUser(id);
  const [editing, setEditing] = useState(false);
  const [assigningRole, setAssigningRole] = useState(false);

  return (
    <QueryState query={query}>
      {(user) => {
        const scopes: {
          kind: ScopeKind;
          label: string;
          ids: string[];
        }[] = [
          {
            kind: 'warehouses',
            label: 'Kho',
            ids: user.scope.warehouseIds,
          },
          {
            kind: 'regions',
            label:
              'Khu vực có quyền — gồm quyền kế thừa',
            ids: user.scope.regionIds,
          },
          {
            kind: 'sales-groups',
            label: 'Nhóm bán hàng',
            ids: user.scope.salesGroupIds,
          },
          {
            kind: 'retailers',
            label: 'Nhà bán lẻ có quyền',
            ids: user.scope.retailerIds,
          },
        ];

        return (
          <>
            <PageHeader
              back="/users"
              title={user.fullName}
              subtitle={user.email}
              actions={
                (can(auth.user, 'users.edit') || can(auth.user, 'users.assignRole')) &&
                user.role !== 'Admin' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                  {can(auth.user, 'users.edit') && <Button
                    onClick={() => setEditing(true)}
                  >
                    Sửa tài khoản
                  </Button>}
                  {can(auth.user, 'users.assignRole') && <Button onClick={() => setAssigningRole(true)}>Đổi vai trò</Button>}
                  </div>
                ) : undefined
              }
            />

            <Card title="Thông tin tài khoản">
              <Fields
                cols={3}
                items={[
                  {
                    label: 'Họ tên',
                    value: user.fullName,
                  },
                  {
                    label: 'Email',
                    value: user.email,
                  },
                  {
                    label: 'Vai trò',
                    value: roleLabel[user.role] ?? user.role,
                  },
                ]}
              />
            </Card>

            <Card title="Phạm vi hiện tại">
              <div
                style={{
                  display: 'grid',
                  gap: 16,
                }}
              >
                {scopes
                  .filter(
                    (scope) => scope.ids.length > 0,
                  )
                  .map((scope) => (
                    <AssignmentPicker
                      key={scope.kind}
                      kind={scope.kind}
                      label={scope.label}
                      value={scope.ids}
                      onChange={() => undefined}
                      readOnly
                    />
                  ))}

                {scopes.every(
                  (scope) => scope.ids.length === 0,
                ) && (
                  <p className="muted">
                    Chưa có scope.
                  </p>
                )}
              </div>
            </Card>

            {(user.businessRole ?? user.role) === 'Retailer' && user.scope.retailerIds.length > 0 && (
              <Card title="Hồ sơ nhà bán lẻ liên kết">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {user.scope.retailerIds.map((retailerId) => (
                    <Button key={retailerId} size="sm" onClick={() => navigate(`/retailers/${retailerId}`)}>
                      Mở chi tiết nhà bán lẻ
                    </Button>
                  ))}
                </div>
              </Card>
            )}

            <UserAuditPanel key={user.id} userId={user.id} />

            {user.role === 'Admin' && (
              <Card>
                Quản trị viên không được chỉnh sửa hoặc khóa
                qua màn này.
              </Card>
            )}

            {editing && user.role !== 'Admin' && (
              <UserDialog
                key={user.id}
                user={user}
                onClose={() => setEditing(false)}
              />
            )}
            {assigningRole && user.role !== 'Admin' && <RoleAssignmentDialog user={user}
              onClose={() => setAssigningRole(false)} onSaved={() => query.refetch()} />}
          </>
        );
      }}
    </QueryState>
  );
}
