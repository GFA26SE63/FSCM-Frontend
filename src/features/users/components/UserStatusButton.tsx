import { useState } from 'react';
import { Button, Modal } from '@/shared/ui';
import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { useSetUserStatus } from '../hooks';
import type { User } from '../types';

export function UserStatusButton({
  user,
}: {
  user: User;
}) {
  const auth = useAuth();
  const mutation = useSetUserStatus();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  if (
    auth.user?.role !== 'Admin' ||
    user.role === 'Admin'
  ) {
    return null;
  }

  return (
    <>
      <Button
        size="sm"
        variant={user.isActive ? 'danger' : 'primary'}
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        {user.isActive ? 'Khóa' : 'Bật'}
      </Button>

      <Modal
        open={open}
        title={
          user.isActive
            ? 'Khóa tài khoản'
            : 'Bật tài khoản'
        }
        onClose={() => {
          if (!mutation.isPending) setOpen(false);
        }}
        footer={
          <>
            <Button
              disabled={mutation.isPending}
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>

            <Button
              variant={
                user.isActive
                  ? 'danger-solid'
                  : 'primary'
              }
              loading={mutation.isPending}
              onClick={async () => {
                try {
                  await mutation.mutateAsync({
                    id: user.id,
                    isActive: !user.isActive,
                  });

                  setOpen(false);
                } catch (failure) {
                  setError(errorMessage(failure));
                }
              }}
            >
              Xác nhận
            </Button>
          </>
        }
      >
        <p>
          {user.fullName} · {user.email}
        </p>

        <p>
          {user.isActive
            ? 'Khóa tài khoản và thu hồi refresh token đang hoạt động.'
            : 'Bật tài khoản không thay thế bước kích hoạt và đặt mật khẩu của tài khoản Local.'}
        </p>

        {error && (
          <div className="callout callout-danger">
            {error}
          </div>
        )}
      </Modal>
    </>
  );
}