import { useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage, toApiError } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { assertPermission, can } from '@/shared/auth/permissions';
import {
  Button,
  Callout,
  Checkbox,
  FormField,
  Input,
  Modal,
  Select,
  useToast,
} from '@/shared/ui';
import {
  useAreas,
  useCreateArea,
  useCreateGroup,
  useGroups,
  useManagers,
  useStaff,
  useTransferStaff,
  useUpdateGroup,
} from '../hooks';
import type { AreaInput, GroupInput, SalesGroup } from '../types';

/* -------------------------------------------------------------------------- */
/*                               Area Dialog                                  */
/* -------------------------------------------------------------------------- */

export function AreaDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const { data: areas = [] } = useAreas();
  const { data: managers = [] } = useManagers();
  const create = useCreateArea();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setCode('');
      setName('');
      setDescription('');
      setManagerId(managers[0]?.id ?? '');
      setErrors({});
      setGeneralError(null);
    }
  }, [open, managers]);

  const validate = () => {
    const err: Record<string, string[]> = {};
    const c = code.trim().toUpperCase();
    const n = name.trim();
    if (!c) err.code = ['Bắt buộc nhập mã khu vực.'];
    else if (areas.some((a) => a.code.toUpperCase() === c)) {
      err.code = ['Mã khu vực đã tồn tại.'];
    }
    if (!n) err.name = ['Bắt buộc nhập tên khu vực.'];
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setGeneralError(null);
    try {
      const payload: AreaInput = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        managerId: managerId || null,
      };
      await create.mutateAsync(payload);
      toast.show(`Đã tạo khu vực ${payload.name} (${payload.code}).`);
      onClose();
    } catch (e) {
      const err = toApiError(e);
      if (Object.keys(err.fieldErrors).length > 0) {
        setErrors(err.fieldErrors);
      } else {
        setGeneralError(err.detail ?? err.title);
      }
    }
  };

  const managerOptions = useMemo(() => {
    const base = [{ value: '', label: '— Chưa phân công —' }];
    return base.concat(managers.map((m) => ({ value: m.id, label: m.name })));
  }, [managers]);

  return (
    <Modal
      open={open}
      title="Thêm khu vực"
      subtitle="Khu vực địa lý phụ trách thị trường"
      width={580}
      onClose={onClose}
      footer={
        <>
          <span className="muted small spacer">* Bắt buộc nhập</span>
          <Button onClick={onClose} disabled={create.isPending}>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={create.isPending}
          >
            {create.isPending ? 'Đang tạo…' : 'Tạo khu vực'}
          </Button>
        </>
      }
    >
      {generalError && <Callout tone="danger">{generalError}</Callout>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
        <FormField label="Mã khu vực" required error={errors.code?.[0]} hint="Ví dụ: Q12, HM, GV, TD, CC">
          <Input
            invalid={!!errors.code?.[0]}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Q12"
          />
        </FormField>

        <FormField label="Tên khu vực" required error={errors.name?.[0]} hint="Ví dụ: Quận 12, Hóc Môn, Gò Vấp">
          <Input
            invalid={!!errors.name?.[0]}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Quận 12"
          />
        </FormField>

        <FormField label="Sales Manager phụ trách">
          <Select
            value={managerId}
            options={managerOptions}
            onChange={(e) => setManagerId(e.target.value)}
          />
        </FormField>

        <FormField
          label="Mô tả / Phạm vi địa lý"
          hint="Mô tả các phường, xã hoặc đặc thù khu vực này"
        >
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Khu vực Quận 12 bao gồm Thới An, Tân Chánh Hiệp..."
          />
        </FormField>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Group Dialog                                 */
/* -------------------------------------------------------------------------- */

export function GroupDialog({
  open,
  group,
  onClose,
}: {
  open: boolean;
  group?: SalesGroup | null;
  onClose: () => void;
}) {
  const edit = !!group;
  const { data: areas = [] } = useAreas();
  const { data: groups = [] } = useGroups();
  const { data: staff = [] } = useStaff();
  const { data: managers = [] } = useManagers();

  const create = useCreateGroup();
  const update = useUpdateGroup();
  const toast = useToast();

  const [code, setCode] = useState('');
  const [areaCode, setAreaCode] = useState('');
  const [managerId, setManagerId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (group) {
        setCode(group.code);
        setAreaCode(group.areaCode);
        setManagerId(group.managerId ?? '');
        setSelectedMembers(group.members ?? []);
      } else {
        const defaultArea = areas[0]?.code ?? '';
        const matchedArea = areas.find((a) => a.code === defaultArea);
        setCode('');
        setAreaCode(defaultArea);
        setManagerId(matchedArea?.managerId ?? managers[0]?.id ?? '');
        setSelectedMembers([]);
      }
      setStaffSearch('');
      setErrors({});
      setGeneralError(null);
    }
  }, [open, group, areas, managers]);

  const handleAreaChange = (nextAreaCode: string) => {
    setAreaCode(nextAreaCode);
    const matched = areas.find((a) => a.code === nextAreaCode);
    if (matched?.managerId) {
      setManagerId(matched.managerId);
    }
  };

  const toggleMember = (name: string) => {
    setSelectedMembers((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name],
    );
  };

  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return staff;
    const q = staffSearch.toLowerCase();
    return staff.filter((s) => s.name.toLowerCase().includes(q));
  }, [staff, staffSearch]);

  const managerOptions = useMemo(() => {
    const base = [{ value: '', label: '— Chưa phân công —' }];
    return base.concat(managers.map((m) => ({ value: m.id, label: m.name })));
  }, [managers]);

  const validate = () => {
    const err: Record<string, string[]> = {};
    const c = code.trim().toUpperCase();
    if (!edit) {
      if (!c) {
        err.code = ['Bắt buộc nhập mã nhóm.'];
      } else if (groups.some((g) => g.code.toUpperCase() === c)) {
        err.code = ['Mã nhóm đã tồn tại.'];
      }
    }
    if (!areaCode) err.areaCode = ['Chọn khu vực.'];
    if (!selectedMembers.length) {
      err.members = ['Vui lòng chọn ít nhất 1 nhân viên Sales cho nhóm.'];
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const busy = create.isPending || update.isPending;

  const submit = async () => {
    if (!validate()) return;
    setGeneralError(null);
    try {
      const selectedManagerObj = managers.find((m) => m.id === managerId);
      const payload: GroupInput = {
        code: code.trim().toUpperCase(),
        areaCode,
        managerId: managerId || null,
        managerName: selectedManagerObj?.name ?? undefined,
        members: selectedMembers,
      };
      if (edit) {
        await update.mutateAsync(payload);
        toast.show(`Đã cập nhật nhóm Sales ${payload.code} (${selectedMembers.length} Sales).`);
      } else {
        await create.mutateAsync(payload);
        toast.show(`Đã tạo nhóm Sales ${payload.code} (${selectedMembers.length} Sales).`);
      }
      onClose();
    } catch (e) {
      const err = toApiError(e);
      if (Object.keys(err.fieldErrors).length > 0) {
        setErrors(err.fieldErrors);
      } else {
        setGeneralError(err.detail ?? err.title);
      }
    }
  };

  return (
    <Modal
      open={open}
      title={edit ? `Sửa nhóm Sales ${group!.code}` : 'Thêm nhóm Sales'}
      subtitle="Phân công khu vực & nhân sự Sales trực thuộc"
      width={680}
      onClose={onClose}
      footer={
        <>
          <span className="muted small spacer">
            Đã chọn <b>{selectedMembers.length}</b> Sales
          </span>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? 'Đang lưu…' : edit ? 'Lưu thay đổi' : 'Tạo nhóm'}
          </Button>
        </>
      }
    >
      <div className="callout" style={{ marginBottom: 12 }}>
        Mỗi nhân viên Sales thuộc đúng một nhóm. Nếu chọn Sales đang ở nhóm khác, họ sẽ tự động được điều chuyển sang nhóm này khi bạn lưu.
      </div>

      {generalError && <Callout tone="danger">{generalError}</Callout>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Mã nhóm" required={!edit} error={errors.code?.[0]} hint="Ví dụ: Q12-C, HM-A, GV-B">
            {edit ? (
              <div className="inp readonly">{code}</div>
            ) : (
              <Input
                invalid={!!errors.code?.[0]}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Q12-C"
              />
            )}
          </FormField>

          <FormField label="Khu vực" required error={errors.areaCode?.[0]}>
            <Select
              value={areaCode}
              options={areas.map((a) => ({ value: a.code, label: `${a.name} (${a.code})` }))}
              onChange={(e) => handleAreaChange(e.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Sales Manager phụ trách">
          <Select
            value={managerId}
            options={managerOptions}
            onChange={(e) => setManagerId(e.target.value)}
          />
        </FormField>

        <div style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              Phân công Sales trong nhóm <span className="muted">({selectedMembers.length} đã chọn) *</span>
            </span>
            <div style={{ width: 220 }}>
              <Input
                style={{ height: 32, fontSize: 12 }}
                placeholder="Tìm nhân viên Sales…"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
              />
            </div>
          </div>

          {errors.members?.[0] && (
            <div className="field-err" style={{ marginBottom: 6 }}>
              {errors.members[0]}
            </div>
          )}

          <div
            style={{
              maxHeight: 220,
              overflowY: 'auto',
              border: '1px solid #CBD5E1',
              borderRadius: 8,
              padding: '6px 10px',
              background: '#FAFAFA',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {filteredStaff.length === 0 ? (
              <div className="muted" style={{ padding: 12, textAlign: 'center', fontSize: 13 }}>
                Không tìm thấy nhân viên Sales phù hợp.
              </div>
            ) : (
              filteredStaff.map((s) => {
                const isSelected = selectedMembers.includes(s.name);
                const isCurrentGroup = s.groupCode === code;
                const otherGroup = s.groupCode && !isCurrentGroup ? s.groupCode : null;

                return (
                  <div
                    key={s.userId || s.name}
                    onClick={() => toggleMember(s.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: isSelected ? '#E6F4EA' : '#FFFFFF',
                      border: isSelected ? '1px solid #14655B' : '1px solid #E2E8F0',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Checkbox
                        label=""
                        checked={isSelected}
                        onChange={() => toggleMember(s.name)}
                      />
                      <span style={{ fontWeight: isSelected ? 600 : 400, fontSize: 14 }}>
                        {s.name}
                      </span>
                    </div>

                    <div style={{ fontSize: 12 }}>
                      {isCurrentGroup && isSelected ? (
                        <span style={{ color: '#14655B', fontWeight: 600 }}>Trong nhóm</span>
                      ) : otherGroup ? (
                        <span style={{ color: '#B45309' }}>
                          Đang ở nhóm <b>{otherGroup}</b>
                        </span>
                      ) : (
                        <span className="muted">Chưa có nhóm</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*                          Transfer Staff Dialog                             */
/* -------------------------------------------------------------------------- */

export function TransferStaffDialog({
  open,
  initialStaffName,
  onClose,
}: {
  open: boolean;
  initialStaffName?: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const staffQuery = useStaff(open);
  const groupsQuery = useGroups();
  const transfer = useTransferStaff();
  const toast = useToast();
  const saving = useRef(false);
  const [userId, setUserId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setUserId('');
      setGroupId('');
      setError('');
    }
  }, [open, initialStaffName]);

  const staff = staffQuery.data ?? [];
  const current = staff.find((s) => s.userId === userId)
    ?? (!userId ? staff.find((s) => s.name === initialStaffName) ?? staff[0] : undefined);
  const destinations = (groupsQuery.data ?? []).filter(
    (g) => g.isActive !== false && g.id && g.id !== current?.groupId,
  );
  const destination = destinations.find((g) => g.id === groupId)
    ?? (!groupId ? destinations[0] : undefined);
  const loading = staffQuery.isLoading || groupsQuery.isLoading;
  const loadError = staffQuery.error || groupsQuery.error;
  const mayAssign = can(user, 'territory.assign');
  const close = () => { if (!saving.current) onClose(); };
  const submit = async () => {
    if (saving.current || loading || loadError) return;
    setError('');
    try {
      assertPermission(user, 'territory.assign');
      if (!current || !destination?.id) {
        setError('Chọn nhân viên và nhóm đích hợp lệ.');
        return;
      }
      saving.current = true;
      await transfer.mutateAsync({
        name: current.name,
        userId: current.userId,
        toGroup: destination.code,
        destinationSalesGroupId: destination.id,
      });
      toast.show('Đã chuyển Sales ' + current.name + ' sang nhóm ' + destination.code + '.');
      onClose();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      saving.current = false;
    }
  };

  if (!mayAssign) return null;
  return (
    <Modal open={open} title="Điều chuyển nhân viên Sales" width={560} onClose={close}
      footer={<>
        <Button onClick={close} disabled={transfer.isPending}>Hủy</Button>
        <Button variant="primary" loading={transfer.isPending}
          disabled={loading || Boolean(loadError) || !current || !destination}
          onClick={() => void submit()}>Xác nhận chuyển</Button>
      </>}
    >
      <Callout tone="info">
        Điều chuyển có hiệu lực ngay.
        {user?.role === 'SalesManager' && ' Chỉ điều chuyển giữa các nhóm bạn được phân công.'}
      </Callout>
      {loading && <p>Đang tải nhân viên và nhóm Sales…</p>}
      {loadError && <Callout tone="danger">{errorMessage(loadError)}</Callout>}
      {error && <Callout tone="danger">{error}</Callout>}
      {!loading && !loadError && staff.length === 0 && <Callout tone="info">
        Chưa có nhân viên Sales trong phạm vi được phân công.
      </Callout>}
      {!loading && !loadError && current && destinations.length === 0 && <Callout tone="info">
        Chưa có nhóm đích khác được phép điều chuyển. Liên hệ Admin để kiểm tra phân công.
      </Callout>}
      <fieldset disabled={loading || Boolean(loadError) || transfer.isPending}
        style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 14, minWidth: 0 }}>
        <FormField label="Nhân viên Sales" required>
          <Select value={current?.userId ?? ''} options={staff.map((s) => ({
            value: s.userId,
            label: s.name + ' (' + (s.groupCode ?? 'Chưa phân nhóm') + ')',
          }))} onChange={(e) => { setUserId(e.target.value); setGroupId(''); }} />
        </FormField>
        <FormField label="Nhóm hiện tại">
          <div className="inp readonly">{current?.groupCode ?? 'Chưa phân nhóm'}</div>
        </FormField>
        <FormField label="Nhóm đích" required>
          <Select value={destination?.id ?? ''} options={destinations.map((g) => ({
            value: g.id!, label: g.code + ' (' + g.areaName + ')',
          }))} onChange={(e) => setGroupId(e.target.value)} />
        </FormField>
      </fieldset>
    </Modal>
  );
}
