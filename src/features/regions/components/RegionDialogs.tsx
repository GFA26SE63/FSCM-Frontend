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
  useUpdateArea,
  useUpdateGroup,
} from '../hooks';
import type { Area, AreaInput, GroupInput, SalesGroup } from '../types';

/* -------------------------------------------------------------------------- */
/*                               Area Dialog                                  */
/* -------------------------------------------------------------------------- */

export function AreaDialog({
  open,
  area,
  onClose,
}: {
  open: boolean;
  area?: Area | null;
  onClose: () => void;
}) {
  const edit = Boolean(area);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const { data: areas = [] } = useAreas();
  const { data: managers = [] } = useManagers();
  const create = useCreateArea();
  const update = useUpdateArea();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      if (area) {
        setCode(area.code);
        setName(area.name);
        setDescription(area.description || '');
        setManagerId(area.managerId ?? '');
      } else {
        setCode('');
        setName('');
        setDescription('');
        setManagerId(managers[0]?.id ?? '');
      }
      setErrors({});
      setGeneralError(null);
    }
  }, [open, area, managers]);

  const validate = () => {
    const err: Record<string, string[]> = {};
    const c = code.trim().toUpperCase();
    const n = name.trim();
    if (!edit) {
      if (!c) err.code = ['Bắt buộc nhập mã vùng.'];
      else if (areas.some((a) => a.code.toUpperCase() === c)) {
        err.code = ['Mã vùng đã tồn tại.'];
      }
    }
    if (!n) err.name = ['Bắt buộc nhập tên vùng.'];
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const busy = create.isPending || update.isPending;

  const submit = async () => {
    if (busy) return;
    if (!validate()) return;
    setGeneralError(null);
    try {
      if (edit && area) {
        await update.mutateAsync({
          idOrCode: area.code,
          data: {
            name: name.trim(),
            description: description.trim() || undefined,
            managerId: managerId || null,
          },
        });
        toast.show(`Đã cập nhật vùng ${name.trim()} (${area.code}).`);
      } else {
        const payload: AreaInput = {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim() || undefined,
          managerId: managerId || null,
        };
        await create.mutateAsync(payload);
        toast.show(`Đã tạo vùng ${payload.name} (${payload.code}).`);
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

  const managerOptions = useMemo(() => {
    const base = [{ value: '', label: '— Chưa phân công —' }];
    return base.concat(managers.map((m) => ({ value: m.id, label: m.name })));
  }, [managers]);

  return (
    <Modal
      open={open}
      title={edit ? `Sửa vùng ${area?.code}` : 'Thêm vùng'}
      subtitle={edit ? 'Cập nhật thông tin vùng hoạt động' : 'Khai báo vùng phụ trách'}
      width={580}
      onClose={onClose}
      footer={
        <>
          <span className="muted small spacer">* Bắt buộc nhập</span>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={busy}
          >
            {busy ? 'Đang lưu…' : edit ? 'Lưu thay đổi' : 'Tạo vùng'}
          </Button>
        </>
      }
    >
      {generalError && <Callout tone="danger">{generalError}</Callout>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
        <FormField label="Mã vùng" required={!edit} error={errors.code?.[0]} hint={edit ? undefined : "Ví dụ: Q12, HM, GV, TD, CC"}>
          {edit ? (
            <div className="inp readonly">{code}</div>
          ) : (
            <Input
              invalid={!!errors.code?.[0]}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Q12"
            />
          )}
        </FormField>

        <FormField label="Tên vùng" required error={errors.name?.[0]} hint="Ví dụ: Quận 12, Hóc Môn, Gò Vấp">
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
  const { data: staff = [], isLoading: staffLoading, error: staffError } = useStaff();
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

  interface GroupMemberItem {
    name: string;
    email?: string;
    phone?: string;
    userId?: string;
  }

  // 1. Staff currently assigned to this group (when editing)
  // Rule 3: Keep them visible in the current group's assigned Sales list.
  const currentGroupStaff = useMemo(() => {
    if (!edit || !group) return [];
    return staff.filter((s) => {
      const matchId = group.id && s.groupId && group.id.toLowerCase() === s.groupId.toLowerCase();
      const matchCode = group.code && s.groupCode && group.code.toUpperCase() === s.groupCode.toUpperCase();
      const matchName = group.members && group.members.includes(s.name);
      return matchId || matchCode || matchName;
    });
  }, [edit, group, staff]);

  const currentGroupMembersList = useMemo<GroupMemberItem[]>(() => {
    if (!edit || !group) return [];
    const fromStaffNames = new Set(currentGroupStaff.map((s) => s.name));
    const extraNames = (group.members ?? []).filter((m) => !fromStaffNames.has(m));
    const list: GroupMemberItem[] = currentGroupStaff.map((s) => ({
      name: s.name,
      email: s.email,
      phone: s.phone,
      userId: s.userId,
    }));
    extraNames.forEach((name) => {
      list.push({ name });
    });
    return list;
  }, [edit, group, currentGroupStaff]);

  // 2. Available unassigned Sales staff candidates
  // Rule 1: Sales not assigned to any group -> Display in available selection list
  // Rule 2: Sales already assigned to another group -> Do NOT display in available selection list
  // Rule 3: Sales already assigned to current group -> Do NOT display as new assignment candidates
  const availableStaff = useMemo(() => {
    return staff.filter((s) => {
      // Exclude if assigned to ANY group
      if (s.groupId || s.groupCode) return false;
      // Also exclude if already in current group's members
      if (edit && group?.members && group.members.includes(s.name)) return false;
      return true;
    });
  }, [staff, edit, group]);

  // 3. Search filtering applies ONLY to available unassigned staff
  // Rule 6: Previously assigned Sales must not reappear upon searching
  const filteredAvailableStaff = useMemo(() => {
    if (!staffSearch.trim()) return availableStaff;
    const q = staffSearch.trim().toLowerCase();
    return availableStaff.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)),
    );
  }, [availableStaff, staffSearch]);

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
      err.members = ['Vui lòng chọn ít nhất 1 nhân viên cho nhóm.'];
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const busy = create.isPending || update.isPending;

  const submit = async () => {
    if (busy) return;
    if (!validate()) return;
    setGeneralError(null);
    try {
      const selectedManagerObj = managers.find((m) => m.id === managerId);
      const uniqueMembers = [...new Set(selectedMembers)];
      const payload: GroupInput = {
        code: code.trim().toUpperCase(),
        areaCode,
        managerId: managerId || null,
        managerName: selectedManagerObj?.name ?? undefined,
        members: uniqueMembers,
      };
      if (edit) {
        await update.mutateAsync(payload);
        toast.show(`Đã cập nhật nhóm bán hàng ${payload.code}.`);
      } else {
        await create.mutateAsync(payload);
        toast.show(`Đã tạo nhóm bán hàng ${payload.code}.`);
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
      title={edit ? `Sửa nhóm bán hàng ${group!.code}` : 'Thêm nhóm bán hàng'}
      subtitle="Phân công khu vực & nhân sự bán hàng trực thuộc"
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
        Mỗi nhân viên bán hàng thuộc đúng một nhóm. Hệ thống chỉ hiển thị các nhân viên chưa được phân công vào nhóm nào để gán.
      </div>

      {edit && group?.isActive === false && (
        <div style={{ marginBottom: 12 }}>
          <Callout tone="warn">
            Nhóm bán hàng này đang tạm ngừng hoạt động. Không thể phân công thêm nhân viên mới vào nhóm đang ngừng hoạt động.
          </Callout>
        </div>
      )}

      {generalError && <Callout tone="danger">{generalError}</Callout>}
      {staffError && (
        <div style={{ marginBottom: 12 }}>
          <Callout tone="danger">
            Không thể kiểm tra thông tin phân công nhân sự. Vui lòng thử lại sau.
          </Callout>
        </div>
      )}

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

        {/* If editing, display the currently assigned sales list */}
        {edit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                Nhân viên đang thuộc nhóm{' '}
                <span className="muted">({currentGroupMembersList.length})</span>
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                Bỏ chọn để xóa khỏi nhóm
              </span>
            </div>

            <div
              style={{
                maxHeight: 140,
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
              {currentGroupMembersList.length === 0 ? (
                <div className="muted" style={{ padding: 10, textAlign: 'center', fontSize: 13 }}>
                  Nhóm hiện chưa có nhân viên Sales nào.
                </div>
              ) : (
                currentGroupMembersList.map((m) => {
                  const isSelected = selectedMembers.includes(m.name);
                  return (
                    <div
                      key={m.userId || m.name}
                      onClick={() => toggleMember(m.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: 6,
                        background: isSelected ? '#E6F4EA' : '#FFFFFF',
                        border: isSelected ? '1px solid #14655B' : '1px solid #E2E8F0',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ pointerEvents: 'none' }}>
                          <Checkbox label="" checked={isSelected} onChange={() => {}} />
                        </div>
                        <div>
                          <span style={{ fontWeight: isSelected ? 600 : 400, fontSize: 13.5 }}>
                            {m.name}
                          </span>
                          {m.email && (
                            <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                              {m.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: 12 }}>
                        {isSelected ? (
                          <span style={{ color: '#14655B', fontWeight: 600 }}>Trong nhóm</span>
                        ) : (
                          <span style={{ color: '#B42318' }}>Sẽ bỏ khỏi nhóm</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Available unassigned sales selection list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {edit ? 'Chọn thêm nhân viên' : 'Phân công nhân viên trong nhóm'}{' '}
              <span className="muted">
                ({availableStaff.length} chưa phân nhóm) *
              </span>
            </span>
            <div style={{ width: 220 }}>
              <Input
                style={{ height: 32, fontSize: 12 }}
                placeholder="Tìm nhân viên…"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
              />
            </div>
          </div>

          {errors.members?.[0] && (
            <div className="field-err" style={{ marginBottom: 4 }}>
              {errors.members[0]}
            </div>
          )}

          <div
            style={{
              maxHeight: edit ? 160 : 220,
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
            {staffLoading ? (
              <div className="muted" style={{ padding: 12, textAlign: 'center', fontSize: 13 }}>
                Đang tải danh sách nhân viên…
              </div>
            ) : edit && group?.isActive === false ? (
              <div className="muted" style={{ padding: 12, textAlign: 'center', fontSize: 13 }}>
                Nhóm bán hàng đang ngừng hoạt động nên không thể phân công thêm nhân viên mới.
              </div>
            ) : filteredAvailableStaff.length === 0 ? (
              <div className="muted" style={{ padding: 12, textAlign: 'center', fontSize: 13 }}>
                {staffSearch.trim()
                  ? `Không tìm thấy nhân viên phù hợp với từ khóa "${staffSearch.trim()}".`
                  : 'Không có nhân viên nào chưa phân nhóm khả dụng.'}
              </div>
            ) : (
              filteredAvailableStaff.map((s) => {
                const isSelected = selectedMembers.includes(s.name);
                return (
                  <div
                    key={s.userId || s.name}
                    onClick={() => toggleMember(s.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: 6,
                      background: isSelected ? '#E6F4EA' : '#FFFFFF',
                      border: isSelected ? '1px solid #14655B' : '1px solid #E2E8F0',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ pointerEvents: 'none' }}>
                        <Checkbox label="" checked={isSelected} onChange={() => {}} />
                      </div>
                      <div>
                        <span style={{ fontWeight: isSelected ? 600 : 400, fontSize: 13.5 }}>
                          {s.name}
                        </span>
                        {s.email && (
                          <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                            {s.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12 }}>
                      {isSelected ? (
                        <span style={{ color: '#14655B', fontWeight: 600 }}>Đã chọn</span>
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
      toast.show('Đã chuyển nhân viên ' + current.name + ' sang nhóm ' + destination.code + '.');
      onClose();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      saving.current = false;
    }
  };

  if (!mayAssign) return null;
  return (
    <Modal open={open} title="Điều chuyển nhân viên bán hàng" width={560} onClose={close}
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
      {loading && <p>Đang tải thông tin nhân viên và nhóm bán hàng…</p>}
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
