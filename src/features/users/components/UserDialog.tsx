import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@/shared/router/compat';
import {
  Button,
  FormField,
  Input,
  Modal,
  Select,
} from '@/shared/ui';
import { toApiError } from '@/shared/api/errors';
import { formatDateTime } from '@/shared/lib';
import { userApi } from '../api';
import { finishUserSave } from '../saveUser';
import {
  assignmentKinds,
  assignmentLabels,
  assignmentsFromUser,
  emptyAssignments,
  roleOptions,
  type Assignments,
  type CreatedUser,
  type CreatableRole,
  type IdentityProvider,
  type UserDetail,
} from '../types';
import { AssignmentPicker } from './AssignmentPicker';
import { isCreatableRole } from '../userPolicy';

interface Props {
  user?: UserDetail;
  onClose: () => void;
}

export function UserDialog({ user, onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(
    user?.fullName ?? '',
  );
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<CreatableRole>(
    isCreatableRole(user?.role)
      ? user.role
      : 'Sales',
  );
  const [provider, setProvider] =
    useState<IdentityProvider>('Local');

  const [assignments, setAssignments] =
    useState<Assignments>(() =>
      user
        ? assignmentsFromUser(user)
        : emptyAssignments(),
    );

  const [errors, setErrors] = useState<
    Record<string, string>
  >({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [created, setCreated] =
    useState<CreatedUser | null>(null);
  const [uncertain, setUncertain] = useState(false);

  const createdRef = useRef<CreatedUser | null>(null);
  const savingRef = useRef(false);

  const identityLocked = !!created;
  const kinds = isCreatableRole(role)
    ? assignmentKinds[role]
    : [];

  function confirmTokenSaved() {
    return (
      !created?.activationToken ||
      window.confirm(
        'Bạn đã lưu activation token chưa? Đóng form sẽ không giữ token trên màn hình.',
      )
    );
  }

  function close() {
    if (savingRef.current) return;
    if (!confirmTokenSaved()) return;
    onClose();
  }

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ['users'],
    });
  }

  function validate() {
    const next: Record<string, string> = {};

    if (!isCreatableRole(role)) {
      next.role =
        'Không được tạo hoặc nâng quyền thành Admin. Hãy chọn vai trò hợp lệ.';
    }

    if (!fullName.trim()) {
      next.fullName = 'Bắt buộc nhập họ tên.';
    } else if (fullName.trim().length > 150) {
      next.fullName = 'Họ tên tối đa 150 ký tự.';
    }

    if (
      email.trim().length > 150 ||
      !/^\S+@\S+\.\S+$/.test(email.trim())
    ) {
      next.email =
        'Nhập email hợp lệ, tối đa 150 ký tự.';
    }

    if (
      role === 'WarehouseKeeper' &&
      assignments.warehouses.length === 0
    ) {
      next.warehouses = 'Chọn ít nhất một kho.';
    }

    if (
      role === 'Sales' &&
      assignments['sales-groups'].length !== 1
    ) {
      next['sales-groups'] = 'Chọn một nhóm Sales.';
    }

    if (
      role === 'Retailer' &&
      assignments.retailers.length !== 1
    ) {
      next.retailers = 'Chọn một retailer.';
    }

    if (
      !user &&
      role === 'SalesManager' &&
      assignments.regions.length === 0
    ) {
      next.regions = 'Chọn ít nhất một region.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (
      savingRef.current ||
      uncertain ||
      user?.role === 'Admin' ||
      !validate()
    ) {
      return;
    }

    savingRef.current = true;
    setBusy(true);
    setMessage('');

    try {
      let id =
        user?.id ?? createdRef.current?.userId;

      if (!id) {
        try {
          const result = await userApi.create({
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            role,
            identityProvider: provider,
          });

          // Ghi nhớ ngay sau POST thành công.
          // Retry phía dưới không tạo lại tài khoản.
          createdRef.current = result;
          setCreated(result);
          id = result.userId;
        } catch (error) {
          const apiError = toApiError(error);

          // Timeout/5xx có thể xảy ra sau khi server đã lưu.
          // Không cho POST lại khi chưa xác định kết quả.
          if (
            apiError.status === 0 ||
            apiError.status >= 500
          ) {
            setUncertain(true);
          }

          throw error;
        }
      }

      await finishUserSave({
        id,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        role,
        assignments,
      });

      await refresh();

      if (user) {
        onClose();
      } else {
        setDone(true);
      }
    } catch (error) {
      const apiError = toApiError(error);
      const fieldErrors: Record<string, string> = {};

      for (const key of [
        'fullName',
        'email',
        'role',
        'identityProvider',
      ]) {
        const fieldError = apiError.field(key);
        if (fieldError) fieldErrors[key] = fieldError;
      }

      setErrors(fieldErrors);
      setMessage(
        (createdRef.current
          ? 'Đã tạo tài khoản; chưa hoàn tất cập nhật/gán scope. '
          : '') +
          (apiError.detail ?? apiError.title),
      );

      // Những request trước lỗi có thể đã lưu thành công.
      void refresh();
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }

  if (user?.role === 'Admin') return null;

  return (
    <Modal
      open
      title={
        done
          ? 'Đã tạo tài khoản'
          : user
            ? 'Sửa tài khoản'
            : 'Tạo tài khoản'
      }
      width={720}
      onClose={close}
      footer={
        <>
          <Button disabled={busy} onClick={close}>
            {done ? 'Đóng' : 'Hủy'}
          </Button>

          {done && created ? (
            <Button
              variant="primary"
              onClick={() => {
                if (!confirmTokenSaved()) return;

                const id = created.userId;
                onClose();
                navigate(
                  `/users/${encodeURIComponent(id)}`,
                );
              }}
            >
              Xem tài khoản
            </Button>
          ) : (
            <Button
              variant="primary"
              loading={busy}
              disabled={uncertain}
              onClick={() => void save()}
            >
              {created
                ? 'Tiếp tục gán assignment'
                : 'Lưu tài khoản'}
            </Button>
          )}
        </>
      }
    >
      <div style={{ display: 'grid', gap: 16 }}>
        {message && (
          <div className="callout callout-danger">
            {message}
          </div>
        )}

        {uncertain && (
          <div className="callout callout-danger">
            Chưa xác định server đã tạo tài khoản hay chưa.
            Đóng form, tìm theo email trong danh sách trước
            khi tạo lại. Nếu đã có, mở Sửa để hoàn thiện
            assignment.
          </div>
        )}

        {created && (
          <div className="callout">
            <p>
              {done
                ? 'Đã hoàn tất.'
                : 'Tài khoản đã được tạo.'}
              {' '}
              {created.email}
            </p>

            {created.activationToken ? (
              <>
                <p>
                  Lưu activation token để người dùng
                  kích hoạt và đặt mật khẩu.
                </p>

                <textarea
                  className="inp"
                  aria-label="Activation token"
                  readOnly
                  rows={4}
                  value={created.activationToken}
                  onFocus={(event) =>
                    event.currentTarget.select()
                  }
                />

                <p>
                  Hết hạn:{' '}
                  {formatDateTime(
                    created.activationTokenExpiresAt,
                  )}
                </p>
              </>
            ) : (
              <p>
                Phương thức đăng nhập ban đầu:
                Microsoft Entra.
              </p>
            )}
          </div>
        )}

        {!done && (
          <fieldset
            disabled={busy || uncertain}
            style={{
              border: 0,
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: 16,
              minWidth: 0,
            }}
          >
            <FormField
              label="Họ tên"
              required
              error={errors.fullName}
            >
              <Input
                value={fullName}
                maxLength={150}
                readOnly={identityLocked}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
              />
            </FormField>

            <FormField
              label="Email đăng nhập"
              required
              error={errors.email}
            >
              <Input
                type="email"
                value={email}
                maxLength={150}
                readOnly={identityLocked}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
              />
            </FormField>

            <FormField
              label="Vai trò"
              required
              error={errors.role}
            >
              <Select
                value={role}
                disabled={!!user || identityLocked}
                options={roleOptions}
                onChange={(event) => {
                  const nextRole = event.target.value;

                  if (!isCreatableRole(nextRole)) {
                    setErrors((current) => ({
                      ...current,
                      role:
                        'Vai trò không hợp lệ. Không được chọn Admin.',
                    }));

                    return;
                  }

                  setRole(nextRole);
                  setAssignments(emptyAssignments());
                  setErrors({});
                }}
              />
            </FormField>

            {!user && (
              <FormField
                label="Phương thức đăng nhập ban đầu"
                required
                error={errors.identityProvider}
              >
                <Select
                  value={provider}
                  disabled={identityLocked}
                  options={[
                    {
                      value: 'Local',
                      label: 'Email và mật khẩu',
                    },
                    {
                      value: 'Entra',
                      label: 'Microsoft Entra ID',
                    },
                  ]}
                  onChange={(event) =>
                    setProvider(
                      event.target.value as IdentityProvider,
                    )
                  }
                />
              </FormField>
            )}

            {user?.role === 'SalesManager' && (
              <>
                <AssignmentPicker
                  kind="regions"
                  label="Khu vực đang có quyền — gồm quyền kế thừa từ nhóm"
                  value={user.scope.regionIds}
                  onChange={() => undefined}
                  readOnly
                />

                <p className="muted">
                  Phần dưới chỉ bổ sung region.
                  Thay đổi nhóm Sales có thể thay đổi
                  quyền khu vực kế thừa.
                </p>
              </>
            )}

            {kinds.map((kind) => (
              <AssignmentPicker
                key={kind}
                kind={kind}
                label={
                  user && kind === 'regions'
                    ? 'Bổ sung khu vực'
                    : assignmentLabels[kind]
                }
                multiple={
                  kind === 'warehouses' ||
                  kind === 'regions'
                }
                value={assignments[kind]}
                disabled={busy}
                error={errors[kind]}
                onChange={(ids) =>
                  setAssignments((current) => ({
                    ...current,
                    [kind]: ids,
                  }))
                }
              />
            ))}

            {role === 'SalesManager' && (
              <p className="muted">
                Nhóm Sales là tùy chọn. Mỗi tài khoản
                hiện chỉ có một membership nhóm Sales
                hoạt động.
              </p>
            )}

            {user?.role === 'Retailer' && (
              <p className="muted">
                Đổi retailer cần bỏ liên kết cũ rồi
                gán liên kết mới. Nếu lỗi giữa chừng,
                lưu lại để hoàn tất.
              </p>
            )}
          </fieldset>
        )}

        <p className="muted">
          Không tạo hoặc chỉnh sửa Admin tại đây.
          Form sửa giữ nguyên role và phương thức
          đăng nhập ban đầu.
        </p>
      </div>
    </Modal>
  );
}