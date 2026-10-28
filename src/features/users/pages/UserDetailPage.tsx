import { useState } from 'react';
import { useParams } from '@/shared/router/compat';
import {
  Button,
  Card,
  Fields,
  PageHeader,
  QueryState,
} from '@/shared/ui';
import { roleLabel } from '@/shared/auth/roles';
import { useAuth } from '@/shared/auth/AuthContext';
import { useUser } from '../hooks';
import { UserDialog } from '../components/UserDialog';
import { AssignmentPicker } from '../components/AssignmentPicker';
import type { ScopeKind } from '../types';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const auth = useAuth();
  const query = useUser(id);
  const [editing, setEditing] = useState(false);

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
            label: 'Nhóm Sales',
            ids: user.scope.salesGroupIds,
          },
          {
            kind: 'retailers',
            label: 'Retailer có quyền',
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
                auth.user?.role === 'Admin' &&
                user.role !== 'Admin' ? (
                  <Button
                    onClick={() => setEditing(true)}
                  >
                    Sửa tài khoản
                  </Button>
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
                    value: roleLabel[user.role],
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

            {user.role === 'Admin' && (
              <Card>
                Admin không được chỉnh sửa hoặc khóa
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
          </>
        );
      }}
    </QueryState>
  );
}