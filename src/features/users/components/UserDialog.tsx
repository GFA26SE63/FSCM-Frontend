import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@/shared/router/compat';
import {
  Button,
  ConfirmDialog,
  FormField,
  Input,
  Modal,
  Select,
} from '@/shared/ui';
import { toApiError } from '@/shared/api/errors';
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
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<CreatableRole>(
    isCreatableRole(user?.role)
      ? user.role
      : 'Sales',
  );
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
  const [confirmationOpen, setConfirmationOpen] =
    useState(false);

  const createdRef = useRef<CreatedUser | null>(null);
  const savingRef = useRef(false);

  const identityLocked = !!created;
  const kinds = isCreatableRole(role)
    ? assignmentKinds[role]
    : [];

  function close() {
    if (savingRef.current) return;
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

    if (!user && !/^0\d{9}$/.test(phone.trim())) {
      next.phone =
        'Số điện thoại gồm 10 chữ số và bắt đầu bằng 0.';
    }

    if (
      !user &&
      (password.length < 12 ||
        !/[A-Z]/.test(password) ||
        !/[a-z]/.test(password) ||
        !/\d/.test(password) ||
        !/[^A-Za-z0-9]/.test(password))
    ) {
      next.password =
        'Mật khẩu tối thiểu 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.';
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
            phone: phone.trim(),
            password,
          });

          // Ghi nhớ ngay sau POST thành công.
          // Retry phía dưới không tạo lại tài khoản.
          createdRef.current = result;
          setCreated(result);
          setPassword('');
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
        'phone',
        'password',
        'role',
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
    <>
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
              onClick={() => {
                if (user) {
                  void save();
                } else if (validate()) {
                  setConfirmationOpen(true);
                }
              }}
            >
              {created
                ? 'Tiếp tục gán assignment'
                : user
                  ? 'Lưu tài khoản'
                  : 'Tạo mới tài khoản'}
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

            <p>
              Người dùng có thể đăng nhập bằng mật khẩu
              hoặc tài khoản Google cùng email.
            </p>
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
              <>
                <FormField
                  label="Số điện thoại"
                  required
                  error={errors.phone}
                >
                  <Input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    maxLength={10}
                    readOnly={identityLocked}
                    onChange={(event) =>
                      setPhone(event.target.value)
                    }
                  />
                </FormField>

                <FormField
                  label="Mật khẩu"
                  required
                  error={errors.password}
                >
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    readOnly={identityLocked}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                  />
                </FormField>
              </>
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

      </div>
      </Modal>

      <ConfirmDialog
        open={confirmationOpen}
        title="Xác nhận tạo mới tài khoản"
        confirmLabel="Hoàn tất tạo tài khoản"
        onClose={() => setConfirmationOpen(false)}
        onConfirm={async () => {
          setConfirmationOpen(false);
          await save();
        }}
        message={
          <div style={{ display: 'grid', gap: 10 }}>
            <p className="muted" style={{ margin: 0 }}>
              Vui lòng kiểm tra lại thông tin trước khi hoàn tất.
            </p>
            <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, margin: 0 }}>
              <dt>Họ tên</dt><dd style={{ margin: 0 }}>{fullName.trim()}</dd>
              <dt>Email đăng nhập</dt><dd style={{ margin: 0 }}>{email.trim().toLowerCase()}</dd>
              <dt>Số điện thoại</dt><dd style={{ margin: 0 }}>{phone.trim()}</dd>
              <dt>Vai trò</dt><dd style={{ margin: 0 }}>{role}</dd>
              <dt>Mật khẩu</dt><dd style={{ margin: 0 }}>{'•'.repeat(Math.min(password.length, 12))}</dd>
            </dl>
          </div>
        }
      />
    </>
  );
}
