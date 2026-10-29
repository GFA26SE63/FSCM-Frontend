import { useEffect, useMemo, useState } from 'react';
import { toApiError } from '@/shared/api/errors';
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
  const [region, setRegion] = useState('Miền Nam');
  const [managerName, setManagerName] = useState('Hồ Gia Bảo');
  const [wardsText, setWardsText] = useState('');
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
      setRegion('Miền Nam');
      setManagerName(managers[0]?.name ?? 'Hồ Gia Bảo');
      setWardsText('');
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
      const wards = wardsText
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean);
      const payload: AreaInput = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        region,
        managerName,
        wards,
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Vùng miền">
            <Select
              value={region}
              options={['Miền Nam', 'Miền Trung', 'Miền Bắc']}
              onChange={(e) => setRegion(e.target.value)}
            />
          </FormField>

          <FormField label="Sales Manager phụ trách">
            <Select
              value={managerName}
              options={managers.map((m) => ({ value: m.name, label: m.name }))}
              onChange={(e) => setManagerName(e.target.value)}
            />
          </FormField>
        </div>

        <FormField
          label="Phường / Xã trực thuộc"
          hint="Nhập danh sách phường/xã, phân tách bằng dấu phẩy (,)"
        >
          <Input
            value={wardsText}
            onChange={(e) => setWardsText(e.target.value)}
            placeholder="Thới An, Tân Chánh Hiệp, Hiệp Thành, Thạnh Lộc"
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
  const [managerName, setManagerName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (group) {
        setCode(group.code);
        setAreaCode(group.areaCode);
        setManagerName(group.managerName);
        setSelectedMembers(group.members ?? []);
      } else {
        const defaultArea = areas[0]?.code ?? 'Q12';
        const matchedArea = areas.find((a) => a.code === defaultArea);
        setCode('');
        setAreaCode(defaultArea);
        setManagerName(matchedArea?.managerName ?? managers[0]?.name ?? 'Hồ Gia Bảo');
        setSelectedMembers([]);
      }
      setStaffSearch('');
      setErrors({});
      setGeneralError(null);
    }
  }, [open, group, areas, managers]);

  // Sync manager when area changes (if manager exists for that area)
  const handleAreaChange = (nextAreaCode: string) => {
    setAreaCode(nextAreaCode);
    const matched = areas.find((a) => a.code === nextAreaCode);
    if (matched?.managerName) {
      setManagerName(matched.managerName);
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
    if (!managerName) err.managerName = ['Chọn Sales Manager.'];
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
      const payload: GroupInput = {
        code: code.trim().toUpperCase(),
        areaCode,
        managerName,
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
        Mỗi nhân viên Sales thuộc đúng một nhóm. Nếu chọn Sales đang ở nhóm khác, họ sẽ tự động được chuyển sang nhóm này khi bạn lưu.
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

        <FormField label="Sales Manager quản lý" required error={errors.managerName?.[0]}>
          <Select
            value={managerName}
            options={managers.map((m) => ({ value: m.name, label: m.name }))}
            onChange={(e) => setManagerName(e.target.value)}
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
                    key={s.name}
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
  const { data: staff = [] } = useStaff();
  const { data: groups = [] } = useGroups();
  const transfer = useTransferStaff();
  const toast = useToast();

  const [staffName, setStaffName] = useState('');
  const [toGroup, setToGroup] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const currentStaff = useMemo(
    () => staff.find((s) => s.name === staffName),
    [staff, staffName],
  );

  const currentGroup = useMemo(
    () => groups.find((g) => g.code === currentStaff?.groupCode),
    [groups, currentStaff],
  );

  const targetGroup = useMemo(
    () => groups.find((g) => g.code === toGroup),
    [groups, toGroup],
  );

  useEffect(() => {
    if (open) {
      const selected = initialStaffName || staff[0]?.name || '';
      setStaffName(selected);
      const s = staff.find((x) => x.name === selected);
      const firstOtherGroup = groups.find((g) => g.code !== s?.groupCode)?.code ?? groups[0]?.code ?? '';
      setToGroup(firstOtherGroup);
      setEffectiveDate(new Date().toISOString().slice(0, 10));
      setErrors({});
      setGeneralError(null);
    }
  }, [open, initialStaffName, staff, groups]);

  const handleStaffChange = (name: string) => {
    setStaffName(name);
    const s = staff.find((x) => x.name === name);
    const firstOther = groups.find((g) => g.code !== s?.groupCode)?.code ?? '';
    setToGroup(firstOther);
  };

  const validate = () => {
    const err: Record<string, string[]> = {};
    if (!staffName) err.staffName = ['Chọn nhân viên Sales.'];
    if (!toGroup) err.toGroup = ['Chọn nhóm đích.'];
    else if (currentStaff?.groupCode === toGroup) {
      err.toGroup = ['Nhóm đích phải khác nhóm hiện tại của nhân viên.'];
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setGeneralError(null);
    try {
      await transfer.mutateAsync({
        name: staffName,
        toGroup,
        effectiveDate: effectiveDate || undefined,
      });
      toast.show(
        `Đã chuyển Sales ${staffName} từ nhóm ${currentStaff?.groupCode ?? 'Chưa phân nhóm'} sang nhóm ${toGroup}.`,
      );
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
      title="Chuyển Sales sang nhóm khác"
      subtitle="Điều chuyển nhân sự giữa các nhóm Sales & khu vực"
      width={560}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={transfer.isPending}>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={transfer.isPending}
          >
            {transfer.isPending ? 'Đang chuyển…' : 'Xác nhận chuyển'}
          </Button>
        </>
      }
    >
      <div className="callout" style={{ marginBottom: 12 }}>
        Sau khi chuyển, nhân viên này sẽ chịu trách nhiệm chăm sóc và phụ trách đặt hàng cho các retailer thuộc nhóm đích.
      </div>

      {generalError && <Callout tone="danger">{generalError}</Callout>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Nhân viên Sales" required error={errors.staffName?.[0]}>
          <Select
            value={staffName}
            options={staff.map((s) => ({
              value: s.name,
              label: `${s.name} (${s.groupCode ? `Nhóm ${s.groupCode}` : 'Chưa phân nhóm'})`,
            }))}
            onChange={(e) => handleStaffChange(e.target.value)}
          />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <span className="fl" style={{ fontSize: 12, color: '#64748B' }}>Nhóm hiện tại</span>
            <div className="inp readonly" style={{ marginTop: 4 }}>
              {currentStaff?.groupCode ? (
                <span>
                  <b>{currentStaff.groupCode}</b> ({currentGroup?.areaName ?? '—'})
                </span>
              ) : (
                <span className="muted">Chưa có nhóm</span>
              )}
            </div>
          </div>

          <FormField label="Nhóm đích" required error={errors.toGroup?.[0]}>
            <Select
              value={toGroup}
              options={groups.map((g) => ({
                value: g.code,
                label: `${g.code} · ${g.areaName}`,
                disabled: g.code === currentStaff?.groupCode,
              }))}
              onChange={(e) => setToGroup(e.target.value)}
            />
          </FormField>
        </div>

        {targetGroup && (
          <div style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, fontSize: 13, border: '1px solid #E2E8F0' }}>
            <span className="muted">Thông tin nhóm đích:</span> Khu vực <b>{targetGroup.areaName}</b> · Quản lý bởi <b>{targetGroup.managerName}</b>
          </div>
        )}

        <FormField label="Ngày hiệu lực" hint="Để trống nếu có hiệu lực ngay lập tức">
          <Input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}
