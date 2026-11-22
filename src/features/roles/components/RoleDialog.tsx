import { useState } from 'react';
import { Button, FormField, Input, Modal, Tabs, type TabItem } from '@/shared/ui';
import { Check, Shield, Layers, AlertCircle } from 'lucide-react';
import { ALL_SCREEN_KEYS, SCREEN_GROUPS, type CreateRoleInput, type RoleItem, type UpdateRoleInput } from '../types';
import { roleApi } from '../api';

interface Props {
  role?: RoleItem | null;
  onClose: () => void;
  onSuccess: (saved: RoleItem) => void;
}

type TabKey = 'general' | 'permissions';

const TABS: TabItem<TabKey>[] = [
  { key: 'general', label: 'Thông tin chung' },
  { key: 'permissions', label: 'Màn hình chức năng' },
];

export function RoleDialog({ role, onClose, onSuccess }: Props) {
  const isEdit = !!role;
  const isAdminRole = role?.code?.toLowerCase() === 'admin';

  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [code, setCode] = useState(role?.code ?? '');
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    () => new Set(isAdminRole ? ALL_SCREEN_KEYS : (role?.permissions ?? []))
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-generate code from name when creating if code wasn't manually edited
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(isEdit);

  function handleNameChange(newName: string) {
    setName(newName);
    if (!codeManuallyEdited && !isEdit) {
      const generated = newName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .toUpperCase();
      setCode(generated);
    }
  }

  function togglePermission(key: string) {
    if (isAdminRole) return;
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleGroup(groupKeys: string[], selectAll: boolean) {
    if (isAdminRole) return;
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      groupKeys.forEach((key) => {
        if (selectAll) {
          next.add(key);
        } else {
          next.delete(key);
        }
      });
      return next;
    });
  }

  function selectAll() {
    if (isAdminRole) return;
    setSelectedPermissions(new Set(ALL_SCREEN_KEYS));
  }

  function deselectAll() {
    if (isAdminRole) return;
    setSelectedPermissions(new Set());
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) {
      nextErrors.name = 'Vui lòng nhập tên vai trò.';
    }
    if (!code.trim()) {
      nextErrors.code = 'Vui lòng nhập mã vai trò.';
    } else if (!isEdit && code.trim().toLowerCase() === 'admin') {
      nextErrors.code = 'Không thể đặt mã là Admin.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setActiveTab('general');
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!validate() || busy) return;

    setBusy(true);
    setErrorMessage(null);

    try {
      if (isEdit && role) {
        const payload: UpdateRoleInput = {
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: Array.from(selectedPermissions),
        };
        const updated = await roleApi.update(role.id, payload);
        onSuccess(updated);
      } else {
        const payload: CreateRoleInput = {
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: Array.from(selectedPermissions),
        };
        const created = await roleApi.create(payload);
        onSuccess(created);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu vai trò.';
      setErrorMessage(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      width={780}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={20} color="var(--primary, #0284c7)" />
          <span>{isEdit ? `Chỉnh sửa vai trò: ${role.name}` : 'Tạo vai trò mới'}</span>
        </div>
      }
      subtitle={
        isEdit
          ? `Mã: ${role.code} ${role.isSystem ? '• Vai trò hệ thống' : ''}`
          : 'Định nghĩa tên vai trò và phân quyền các màn hình chức năng được phép truy cập'
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            {selectedPermissions.size > 0 ? (
              <span>
                Đã chọn <strong>{selectedPermissions.size}</strong> / {ALL_SCREEN_KEYS.length} màn hình
              </span>
            ) : (
              <span>Chưa chọn màn hình chức năng nào</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={busy}>
              {busy ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo vai trò'}
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              borderRadius: 6,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <Tabs items={TABS} value={activeTab} onChange={(tab) => setActiveTab(tab)} />

        {/* TAB 1: THÔNG TIN CHUNG */}
        {activeTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            <FormField label="Tên vai trò" required error={errors.name}>
              <Input
                placeholder="Ví dụ: Nhân viên kiểm kê, Kế toán công nợ..."
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={busy}
                autoFocus
              />
            </FormField>

            <FormField
              label="Mã vai trò (Code)"
              required
              error={errors.code}
              hint={
                isEdit
                  ? 'Mã vai trò được dùng để định danh duy nhất trong hệ thống và không thể thay đổi sau khi tạo.'
                  : 'Mã định danh duy nhất (chữ cái không dấu, chữ số, gạch dưới). Tự động tạo theo tên vai trò.'
              }
            >
              <Input
                placeholder="Ví dụ: INVENTORY_STAFF, ACCOUNTANT"
                value={code}
                onChange={(e) => {
                  setCodeManuallyEdited(true);
                  setCode(e.target.value.toUpperCase());
                }}
                disabled={isEdit || busy}
              />
            </FormField>

            <FormField label="Mô tả chức năng">
              <textarea
                className="input"
                style={{ width: '100%', minHeight: 90, padding: 8, resize: 'vertical' }}
                placeholder="Mô tả trách nhiệm, phạm vi công việc và quyền hạn của vai trò này..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
              />
            </FormField>

            {role?.isSystem && (
              <div
                style={{
                  padding: 12,
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: 6,
                  color: '#0369a1',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <strong>Vai trò hệ thống cốt lõi:</strong> Vai trò này được cấu hình mặc định cho luồng vận hành của hệ thống FSCM.
                {isAdminRole && ' Quản trị viên (Admin) luôn có toàn quyền truy cập tất cả màn hình chức năng.'}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CÁC MÀN HÌNH CHỨC NĂNG */}
        {activeTab === 'permissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>
            {isAdminRole ? (
              <div
                style={{
                  padding: 16,
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 6,
                  color: '#15803d',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Shield size={24} color="#16a34a" />
                <div>
                  <strong>Toàn quyền truy cập:</strong> Tài khoản có vai trò Quản trị viên (Admin) được cấp quyền truy cập toàn bộ màn hình và tính năng trong hệ thống.
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                }}
              >
                <div style={{ fontSize: 13, color: '#475569' }}>
                  Tick chọn các màn hình chức năng mà người dùng thuộc vai trò này được phép truy cập trên cổng Web:
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={selectAll}
                    style={{ fontSize: 12, padding: '2px 8px' }}
                  >
                    Chọn tất cả ({ALL_SCREEN_KEYS.length})
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={deselectAll}
                    style={{ fontSize: 12, padding: '2px 8px' }}
                  >
                    Bỏ chọn tất cả
                  </button>
                </div>
              </div>
            )}

            <div
              style={{
                maxHeight: '440px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                paddingRight: 4,
              }}
            >
              {SCREEN_GROUPS.map((group) => {
                const groupKeys = group.screens.map((s) => s.key);
                const selectedInGroup = groupKeys.filter((k) => selectedPermissions.has(k)).length;
                const allInGroupSelected = selectedInGroup === groupKeys.length;

                return (
                  <div
                    key={group.key}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      overflow: 'hidden',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Layers size={16} color="#64748b" />
                        <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
                          {group.label}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '1px 6px',
                            borderRadius: 12,
                            backgroundColor: selectedInGroup > 0 ? '#e0f2fe' : '#f1f5f9',
                            color: selectedInGroup > 0 ? '#0369a1' : '#64748b',
                            fontWeight: 500,
                          }}
                        >
                          {selectedInGroup}/{groupKeys.length}
                        </span>
                      </div>

                      {!isAdminRole && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 12, padding: '2px 8px' }}
                          onClick={() => toggleGroup(groupKeys, !allInGroupSelected)}
                        >
                          {allInGroupSelected ? 'Bỏ chọn nhóm' : 'Chọn cả nhóm'}
                        </button>
                      )}
                    </div>

                    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {group.screens.map((screen) => {
                        const checked = isAdminRole || selectedPermissions.has(screen.key);

                        return (
                          <label
                            key={screen.key}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 10,
                              padding: '8px 10px',
                              borderRadius: 6,
                              cursor: isAdminRole ? 'default' : 'pointer',
                              backgroundColor: checked ? '#f0fdf4' : 'transparent',
                              transition: 'background-color 0.15s ease',
                              border: checked ? '1px solid #bbf7d0' : '1px solid transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isAdminRole}
                              onChange={() => togglePermission(screen.key)}
                              style={{ marginTop: 3, cursor: isAdminRole ? 'default' : 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                                  {screen.name}
                                </span>
                                <code
                                  style={{
                                    fontSize: 11,
                                    backgroundColor: '#f1f5f9',
                                    color: '#475569',
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                  }}
                                >
                                  {screen.key}
                                </code>
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                {screen.description}
                              </div>
                            </div>
                            {checked && (
                              <Check size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: 3 }} />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
