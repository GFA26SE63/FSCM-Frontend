import { SimpleTable } from '@/shared/ui';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { Button, ConfirmDialog, Input, PageHeader } from '@/shared/ui';
import { Shield, Plus, Search, Edit2, Trash2, Users, Layers, AlertCircle, RefreshCw, Smartphone, Monitor } from 'lucide-react';
import { roleApi } from '../api';
import { RoleDialog } from '../components/RoleDialog';
import {
  ALL_WEB_SCREEN_KEYS,
  ALL_MOBILE_SCREEN_KEYS,
  type RoleItem,
} from '../types';

export function RolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'web' | 'mobile'>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);

  // Delete dialog state
  const [deletingRole, setDeletingRole] = useState<RoleItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await roleApi.list(search);
      setRoles(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách vai trò.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  function handleCreateClick() {
    setEditingRole(null);
    setDialogOpen(true);
  }

  function handleEditClick(role: RoleItem) {
    setEditingRole(role);
    setDialogOpen(true);
  }

  function handleSaved(saved: RoleItem) {
    setRoles((prev) => {
      const index = prev.findIndex((r) => r.id === saved.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = saved;
        return next;
      }
      return [...prev, saved];
    });
  }

  async function handleDeleteConfirm() {
    if (!deletingRole || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await roleApi.delete(deletingRole.id);
      setRoles((prev) => prev.filter((r) => r.id !== deletingRole.id));
      setDeletingRole(null);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Không thể xóa vai trò này.');
    } finally {
      setDeleteBusy(false);
    }
  }

  const systemCount = roles.filter((r) => r.isSystem).length;
  const customCount = roles.length - systemCount;

  const webRolesCount = useMemo(() => {
    return roles.filter((r) => {
      if (r.code.toLowerCase() === 'admin') return true;
      return r.permissions.some((p) => ALL_WEB_SCREEN_KEYS.includes(p));
    }).length;
  }, [roles]);

  const mobileRolesCount = useMemo(() => {
    return roles.filter((r) => {
      if (r.code.toLowerCase() === 'admin') return true;
      return (
        r.permissions.some((p) => p.startsWith('mobile-')) ||
        (r.baseRole ?? r.code) === 'Sales' ||
        (r.baseRole ?? r.code) === 'Retailer'
      );
    }).length;
  }, [roles]);

  const filteredRoles = useMemo(() => {
    if (platformFilter === 'all') return roles;
    if (platformFilter === 'web') {
      return roles.filter((r) => {
        if (r.code.toLowerCase() === 'admin') return true;
        return r.permissions.some((p) => ALL_WEB_SCREEN_KEYS.includes(p));
      });
    }
    if (platformFilter === 'mobile') {
      return roles.filter((r) => {
        if (r.code.toLowerCase() === 'admin') return true;
        return (
          r.permissions.some((p) => p.startsWith('mobile-')) ||
          (r.baseRole ?? r.code) === 'Sales' ||
          (r.baseRole ?? r.code) === 'Retailer'
        );
      });
    }
    return roles;
  }, [roles, platformFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Vai trò & Phân quyền"
        subtitle="Quản trị các vai trò trong hệ thống và thiết lập quyền truy cập màn hình chức năng cho từng nhóm người dùng."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={loadRoles} disabled={loading} aria-label="Tải lại">
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </Button>
            <Button variant="primary" onClick={handleCreateClick}>
              <Plus size={16} style={{ marginRight: 6 }} />
              Tạo vai trò mới
            </Button>
          </div>
        }
      />

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              backgroundColor: '#e0f2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={22} color="#0284c7" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Tổng số vai trò</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{roles.length}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              backgroundColor: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={22} color="#475569" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Vai trò hệ thống</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{systemCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              backgroundColor: '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={22} color="#16a34a" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Vai trò tùy chỉnh</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{customCount}</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 360 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }} />
          <Input
            placeholder="Tìm kiếm theo tên hoặc mã vai trò…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#64748b', marginRight: 4 }}>Nền tảng:</span>
          <button
            type="button"
            onClick={() => setPlatformFilter('all')}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid',
              borderColor: platformFilter === 'all' ? '#0f766e' : '#e2e8f0',
              backgroundColor: platformFilter === 'all' ? '#f0fdfa' : '#fff',
              color: platformFilter === 'all' ? '#0f766e' : '#475569',
              fontWeight: platformFilter === 'all' ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Tất cả ({roles.length})
          </button>
          <button
            type="button"
            onClick={() => setPlatformFilter('web')}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid',
              borderColor: platformFilter === 'web' ? '#0284c7' : '#e2e8f0',
              backgroundColor: platformFilter === 'web' ? '#f0f9ff' : '#fff',
              color: platformFilter === 'web' ? '#0284c7' : '#475569',
              fontWeight: platformFilter === 'web' ? 600 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <Monitor size={14} /> Cổng Web ({webRolesCount})
          </button>
          <button
            type="button"
            onClick={() => setPlatformFilter('mobile')}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid',
              borderColor: platformFilter === 'mobile' ? '#7c3aed' : '#e2e8f0',
              backgroundColor: platformFilter === 'mobile' ? '#f5f3ff' : '#fff',
              color: platformFilter === 'mobile' ? '#7c3aed' : '#475569',
              fontWeight: platformFilter === 'mobile' ? 600 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <Smartphone size={14} /> Ứng dụng Di động ({mobileRolesCount})
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Table list */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-responsive">
          <SimpleTable paginate rows={filteredRoles.map((role) => {
                  const isAdmin = role.code.toLowerCase() === 'admin';
                  const isSalesOrRetailer = role.code === 'Sales' || role.code === 'Retailer';
                  const webPerms = role.permissions.filter((p) => ALL_WEB_SCREEN_KEYS.includes(p));
                  const mobilePerms = role.permissions.filter((p) => p.startsWith('mobile-'));

                  const hasWeb = isAdmin || webPerms.length > 0;
                  const hasMobile = isAdmin || mobilePerms.length > 0 || isSalesOrRetailer;

                   return { role, isAdmin, isSalesOrRetailer, webPerms, mobilePerms, hasWeb, hasMobile }; })} empty={loading && roles.length === 0 ? 'Đang tải danh sách vai trò…' : 'Không tìm thấy vai trò nào phù hợp.'} columns={[{ header: "Vai trò", cell: ({ role }) => <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                            {role.name}
                          </span>
                          <code
                            style={{
                              fontSize: 11,
                              color: '#64748b',
                              backgroundColor: '#f1f5f9',
                              padding: '1px 5px',
                              borderRadius: 4,
                              width: 'fit-content',
                            }}
                          >
                            {role.code}
                          </code>
                        </div>
                      </> },
{ header: "Nền tảng & Loại", cell: ({ role, isAdmin, isSalesOrRetailer, hasWeb, hasMobile }) => <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          {/* Platform Badge */}
                          {isAdmin ? (
                            <span
                              style={{
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 6,
                                backgroundColor: '#f0fdf4',
                                color: '#166534',
                                border: '1px solid #bbf7d0',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              🖥️ Web & 📱 Mobile
                            </span>
                          ) : isSalesOrRetailer || (!hasWeb && hasMobile) ? (
                            <span
                              style={{
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 6,
                                backgroundColor: '#f5f3ff',
                                color: '#6d28d9',
                                border: '1px solid #ddd6fe',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              📱 Mobile App
                            </span>
                          ) : hasWeb && hasMobile ? (
                            <span
                              style={{
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 6,
                                backgroundColor: '#f0f9ff',
                                color: '#0369a1',
                                border: '1px solid #bae6fd',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              🖥️ Web & 📱 Mobile
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 6,
                                backgroundColor: '#f8fafc',
                                color: '#475569',
                                border: '1px solid #e2e8f0',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              🖥️ Cổng Web
                            </span>
                          )}

                          {/* Role type */}
                          {role.isSystem ? (
                            <span
                              style={{
                                fontSize: 11,
                                padding: '1px 6px',
                                borderRadius: 4,
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                fontWeight: 500,
                              }}
                            >
                              Hệ thống
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 11,
                                padding: '1px 6px',
                                borderRadius: 4,
                                backgroundColor: '#fffbeb',
                                color: '#b45309',
                                fontWeight: 500,
                              }}
                            >
                              Tùy chỉnh
                            </span>
                          )}
                        </div>
                      </> },
{ header: "Màn hình / Tính năng được cấp", cell: ({ isAdmin, isSalesOrRetailer, webPerms, mobilePerms, hasWeb, hasMobile }) => <>
                        {isAdmin ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#16a34a',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Shield size={14} /> Toàn quyền hệ thống
                            </span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>
                              {ALL_WEB_SCREEN_KEYS.length} Web + {ALL_MOBILE_SCREEN_KEYS.length} Mobile
                            </span>
                          </div>
                        ) : isSalesOrRetailer || (!hasWeb && hasMobile) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div
                                style={{
                                  width: 60,
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: '#ede9fe',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.round((mobilePerms.length / ALL_MOBILE_SCREEN_KEYS.length) * 100)}%`,
                                    height: '100%',
                                    backgroundColor: '#7c3aed',
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: 12, color: '#6d28d9', fontWeight: 600 }}>
                                {mobilePerms.length} / {ALL_MOBILE_SCREEN_KEYS.length} tính năng Mobile
                              </span>
                            </div>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>
                              Dành cho ứng dụng di động FSCM
                            </span>
                          </div>
                        ) : hasWeb && hasMobile ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Monitor size={12} color="#0284c7" />
                              <span style={{ fontSize: 12, color: '#334155', fontWeight: 500 }}>
                                {webPerms.length} / {ALL_WEB_SCREEN_KEYS.length} Web
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Smartphone size={12} color="#7c3aed" />
                              <span style={{ fontSize: 12, color: '#6d28d9', fontWeight: 500 }}>
                                {mobilePerms.length} / {ALL_MOBILE_SCREEN_KEYS.length} Mobile
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                width: 70,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: '#e2e8f0',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.round((webPerms.length / ALL_WEB_SCREEN_KEYS.length) * 100)}%`,
                                  height: '100%',
                                  backgroundColor: '#0284c7',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>
                              {webPerms.length} / {ALL_WEB_SCREEN_KEYS.length}
                            </span>
                          </div>
                        )}
                      </> },
{ header: "Người dùng", cell: ({ role }) => <>
                        <span
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            borderRadius: 12,
                            backgroundColor: role.userCount > 0 ? '#f0fdf4' : '#f8fafc',
                            color: role.userCount > 0 ? '#15803d' : '#94a3b8',
                            fontWeight: 500,
                          }}
                        >
                          {role.userCount} tài khoản
                        </span>
                      </> },
{ header: "Mô tả", cell: ({ role }) => <>
                        <div
                          style={{
                            fontSize: 13,
                            color: '#64748b',
                          }}
                          title={role.description ?? ''}
                        >
                          {role.description || '—'}
                        </div>
                      </> },
{ header: "Thao tác", cell: ({ role }) => <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(role)}
                            aria-label={`Chỉnh sửa ${role.name}`}
                            title="Chỉnh sửa vai trò"
                          >
                            <Edit2 size={14} style={{ marginRight: 4 }} />
                            Chỉnh sửa
                          </Button>

                          {!role.isSystem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeleteError(null);
                                setDeletingRole(role);
                              }}
                              disabled={role.userCount > 0}
                              aria-label={`Xóa ${role.name}`}
                              title={
                                role.userCount > 0
                                  ? 'Không thể xóa vai trò đang có người dùng'
                                  : 'Xóa vai trò'
                              }
                              style={{ color: role.userCount > 0 ? undefined : '#dc2626' }}
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </> }]} />
        </div>
      </div>

      {/* Role Dialog (2 tabs: General Info & Permissions) */}
      {dialogOpen && (
        <RoleDialog
          role={editingRole}
          onClose={() => setDialogOpen(false)}
          onSuccess={handleSaved}
        />
      )}

      {/* Delete Confirmation */}
      {deletingRole && (
        <ConfirmDialog
          open
          title="Xác nhận xóa vai trò"
          message={
            <div>
              Bạn có chắc chắn muốn xóa vai trò <strong>{deletingRole.name}</strong> (mã:{' '}
              <code>{deletingRole.code}</code>) khỏi hệ thống không?
              {deleteError && (
                <div style={{ color: '#dc2626', marginTop: 10, fontSize: 13 }}>
                  {deleteError}
                </div>
              )}
            </div>
          }
          confirmLabel={deleteBusy ? 'Đang xóa…' : 'Xóa vai trò'}
          danger
          onClose={() => setDeletingRole(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
