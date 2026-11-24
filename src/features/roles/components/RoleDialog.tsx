import { useState, useMemo, type ReactNode } from 'react';
import { Button, FormField, Input, Modal, Tabs, type TabItem } from '@/shared/ui';
import { Check, Shield, Layers, AlertCircle, ChevronDown, ChevronRight, Search, Smartphone, Monitor } from 'lucide-react';
import {
  ALL_SCREEN_KEYS,
  ALL_WEB_SCREEN_KEYS,
  ALL_MOBILE_SCREEN_KEYS,
  WEB_SCREEN_GROUPS,
  MOBILE_SCREEN_GROUPS,
  DEFAULT_ROLE_PERMISSIONS,
  type CreateRoleInput,
  type RoleItem,
  type ScreenGroup,
  type UpdateRoleInput,
} from '../types';
import { roleApi } from '../api';

interface Props {
  role?: RoleItem | null;
  onClose: () => void;
  onSuccess: (saved: RoleItem) => void;
}

type TabKey = 'general' | 'web' | 'mobile';

export function RoleDialog({ role, onClose, onSuccess }: Props) {
  const isEdit = !!role;
  const isAdminRole = role?.code?.toLowerCase() === 'admin';
  const isMobileRole = role?.code === 'Sales' || role?.code === 'Retailer';

  // Default to Mobile tab if role is Sales or Retailer
  const [activeTab, setActiveTab] = useState<TabKey>(isMobileRole ? 'mobile' : 'general');
  const [code, setCode] = useState(role?.code ?? '');
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');

  // Initialize selected permissions:
  // If editing an existing role that has permissions, use them.
  // If role has 0 permissions but has defaults (e.g. Sales, Retailer), pre-fill with defaults.
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(() => {
    if (isAdminRole) return new Set(ALL_SCREEN_KEYS);
    if (role?.permissions && role.permissions.length > 0) return new Set(role.permissions);
    if (role?.code && DEFAULT_ROLE_PERMISSIONS[role.code]) {
      return new Set(DEFAULT_ROLE_PERMISSIONS[role.code]);
    }
    return new Set();
  });

  // Accordion state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set([...WEB_SCREEN_GROUPS, ...MOBILE_SCREEN_GROUPS].map((g) => g.key))
  );

  const [webSearch, setWebSearch] = useState('');
  const [mobileSearch, setMobileSearch] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  function toggleExpandGroup(groupKey: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  function expandAll(groups: ScreenGroup[]) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      groups.forEach((g) => next.add(g.key));
      return next;
    });
  }

  function collapseAll(groups: ScreenGroup[]) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      groups.forEach((g) => next.delete(g.key));
      return next;
    });
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

  function selectAllInList(keys: string[]) {
    if (isAdminRole) return;
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  }

  function deselectAllInList(keys: string[]) {
    if (isAdminRole) return;
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    });
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

  const selectedWebCount = useMemo(() => {
    return ALL_WEB_SCREEN_KEYS.filter((k) => selectedPermissions.has(k)).length;
  }, [selectedPermissions]);

  const selectedMobileCount = useMemo(() => {
    return ALL_MOBILE_SCREEN_KEYS.filter((k) => selectedPermissions.has(k)).length;
  }, [selectedPermissions]);

  const tabs: TabItem<TabKey>[] = [
    { key: 'general', label: 'Thông tin chung' },
    {
      key: 'web',
      label: `Cổng Web (${selectedWebCount}/${ALL_WEB_SCREEN_KEYS.length})`,
    },
    {
      key: 'mobile',
      label: `Ứng dụng Di động (${selectedMobileCount}/${ALL_MOBILE_SCREEN_KEYS.length})`,
    },
  ];

  function renderGroupList(
    groups: ScreenGroup[],
    allKeys: string[],
    searchVal: string,
    setSearchVal: (v: string) => void,
    platform: 'web' | 'mobile',
    bannerNotice?: ReactNode
  ) {
    const q = searchVal.trim().toLowerCase();
    const filtered = !q
      ? groups
      : groups
          .map((group) => ({
            ...group,
            screens: group.screens.filter(
              (s) =>
                s.name.toLowerCase().includes(q) ||
                s.key.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q)
            ),
          }))
          .filter((group) => group.screens.length > 0);

    const isGroupExpanded = (groupKey: string) => {
      if (q) return true;
      return expandedGroups.has(groupKey);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
        {isAdminRole ? (
          <div
            style={{
              padding: 14,
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              color: '#15803d',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Shield size={24} color="#16a34a" style={{ flexShrink: 0 }} />
            <div>
              <strong>Toàn quyền truy cập {platform === 'web' ? 'Cổng Web' : 'Ứng dụng Di động'}:</strong> Tài khoản có vai trò Quản trị viên (Admin) luôn được cấp toàn quyền truy cập toàn bộ {allKeys.length} tính năng.
            </div>
          </div>
        ) : (
          <>
            {bannerNotice}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '10px 14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  {platform === 'web'
                    ? 'Tick chọn các màn hình chức năng trên Cổng Web:'
                    : 'Tick chọn các màn hình / tính năng trên FSCM Mobile App:'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => selectAllInList(allKeys)}
                    style={{ fontSize: 12, padding: '3px 8px' }}
                  >
                    Chọn tất cả ({allKeys.length})
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => deselectAllInList(allKeys)}
                    style={{ fontSize: 12, padding: '3px 8px' }}
                  >
                    Bỏ chọn tất cả
                  </button>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => expandAll(groups)}
                    style={{ fontSize: 12, padding: '3px 8px' }}
                  >
                    Mở rộng tất cả
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => collapseAll(groups)}
                    style={{ fontSize: 12, padding: '3px 8px' }}
                  >
                    Thu gọn tất cả
                  </button>
                </div>
              </div>

              {/* Quick search input */}
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder={
                    platform === 'web'
                      ? 'Tìm nhanh màn hình Web theo tên hoặc mã (ví dụ: kho, xuất kho, đơn hàng, người dùng...)'
                      : 'Tìm nhanh tính năng Mobile theo tên hoặc mã (ví dụ: đơn hàng, quét qr, điểm bán, tích điểm...)'
                  }
                  style={{
                    width: '100%',
                    padding: '6px 30px 6px 32px',
                    fontSize: 13,
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    backgroundColor: '#ffffff',
                    outline: 'none',
                  }}
                />
                {searchVal && (
                  <button
                    type="button"
                    onClick={() => setSearchVal('')}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      fontSize: 12,
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '2px 6px',
                    }}
                  >
                    Xóa
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        <div
          style={{
            maxHeight: '480px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            paddingRight: 4,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
              Không tìm thấy tính năng nào khớp với từ khóa "{searchVal}".
            </div>
          ) : (
            filtered.map((group) => {
              const groupKeys = group.screens.map((s) => s.key);
              const selectedInGroup = groupKeys.filter((k) => selectedPermissions.has(k)).length;
              const allInGroupSelected = groupKeys.length > 0 && selectedInGroup === groupKeys.length;
              const expanded = isGroupExpanded(group.key);

              return (
                <div
                  key={group.key}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                    flexShrink: 0,
                  }}
                >
                  <div
                    onClick={() => toggleExpandGroup(group.key)}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: expanded ? '#f8fafc' : '#ffffff',
                      borderBottom: expanded ? '1px solid #e2e8f0' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
                        {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </span>
                      {platform === 'web' ? <Layers size={16} color="#64748b" /> : <Smartphone size={16} color="#0284c7" />}
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
                        {group.label}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 12,
                          backgroundColor:
                            allInGroupSelected
                              ? '#dcfce7'
                              : selectedInGroup > 0
                              ? '#e0f2fe'
                              : '#f1f5f9',
                          color:
                            allInGroupSelected
                              ? '#15803d'
                              : selectedInGroup > 0
                              ? '#0369a1'
                              : '#64748b',
                          fontWeight: 600,
                        }}
                      >
                        {selectedInGroup}/{groupKeys.length}
                      </span>
                    </div>

                    {!isAdminRole && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 12, padding: '3px 10px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroup(groupKeys, !allInGroupSelected);
                        }}
                      >
                        {allInGroupSelected ? 'Bỏ chọn nhóm' : 'Chọn cả nhóm'}
                      </button>
                    )}
                  </div>

                  {expanded && (
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
                              style={{
                                marginTop: 3,
                                flexShrink: 0,
                                cursor: isAdminRole ? 'default' : 'pointer',
                                accentColor: '#16a34a',
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>
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
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      width={800}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={20} color="var(--primary, #0284c7)" />
          <span>{isEdit ? `Chỉnh sửa vai trò: ${role.name}` : 'Tạo vai trò mới'}</span>
        </div>
      }
      subtitle={
        isEdit
          ? `Mã: ${role.code} ${role.isSystem ? '• Vai trò hệ thống' : ''} ${isMobileRole ? '• Ứng dụng Di động' : ''}`
          : 'Định nghĩa tên vai trò và phân quyền các màn hình chức năng trên Cổng Web và Ứng dụng Di động'
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            <span>
              Đã chọn: <strong style={{ color: '#0369a1' }}>{selectedWebCount}</strong>/{ALL_WEB_SCREEN_KEYS.length} Web
              {' • '}
              <strong style={{ color: '#15803d' }}>{selectedMobileCount}</strong>/{ALL_MOBILE_SCREEN_KEYS.length} Mobile
            </span>
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

        <Tabs items={tabs} value={activeTab} onChange={(tab) => setActiveTab(tab)} />

        {/* TAB 1: THÔNG TIN CHUNG */}
        {activeTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            <FormField label="Tên vai trò" required error={errors.name}>
              <Input
                placeholder="Ví dụ: Nhân viên kiểm kê, Kế toán công nợ, Nhân viên thị trường..."
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

            {/* Platform scope notice */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  padding: 12,
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <Monitor size={18} color="#0284c7" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                    Cổng Web ({ALL_WEB_SCREEN_KEYS.length} màn hình)
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Dành cho Quản trị viên, Vận hành, Thủ kho và Quản lý bán hàng trên máy tính.
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <Smartphone size={18} color="#16a34a" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                    Ứng dụng Di động ({ALL_MOBILE_SCREEN_KEYS.length} tính năng)
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Dành cho Nhân viên bán hàng (Sales), Đại lý (Retailer) và Thủ kho trên điện thoại.
                  </div>
                </div>
              </div>
            </div>

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

        {/* TAB 2: CỔNG WEB */}
        {activeTab === 'web' &&
          renderGroupList(
            WEB_SCREEN_GROUPS,
            ALL_WEB_SCREEN_KEYS,
            webSearch,
            setWebSearch,
            'web',
            isMobileRole ? (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 8,
                  color: '#92400e',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <AlertCircle size={18} color="#d97706" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Lưu ý:</strong> Vai trò <strong>{role?.name}</strong> là vai trò chuyên biệt cho <strong>Ứng dụng di động (Mobile App)</strong>. Mặc định người dùng thuộc vai trò này không đăng nhập vào Cổng Web trừ khi bạn cấp quyền tại tab này.
                </div>
              </div>
            ) : null
          )}

        {/* TAB 3: ỨNG DỤNG DI ĐỘNG */}
        {activeTab === 'mobile' &&
          renderGroupList(
            MOBILE_SCREEN_GROUPS,
            ALL_MOBILE_SCREEN_KEYS,
            mobileSearch,
            setMobileSearch,
            'mobile',
            isMobileRole ? (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 8,
                  color: '#15803d',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Smartphone size={18} color="#16a34a" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Tính năng ứng dụng di động:</strong> Thiết lập các màn hình và quyền thao tác cho người dùng <strong>{role?.name}</strong> trên ứng dụng FSCM Mobile.
                </div>
              </div>
            ) : null
          )}
      </div>
    </Modal>
  );
}
