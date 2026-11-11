import { useState } from 'react';
import { ArrowRightLeft, Eye, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { useNavigate } from '@/shared/router/compat';
import {
  ActionDropdown,
  Button,
  ConfirmDialog,
  DataTable,
  Modal,
  PageHeader,
  StatusChip,
  Tabs,
  useToast,
  type ActionDropdownItem,
  type Column,
} from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import {
  useAreas,
  useDeleteArea,
  useDeleteGroup,
  useGroups,
  useUpdateAreaStatus,
  useUpdateGroupStatus,
} from '../hooks';
import { regionApi } from '../api';
import {
  AreaDialog,
  GroupDialog,
  TransferStaffDialog,
} from '../components/RegionDialogs';
import type { Area, SalesGroup } from '../types';

export function RegionsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [tab, setTab] = useState<'groups' | 'areas'>('groups');
  const areas = useAreas();
  const groups = useGroups();

  const updateAreaStatusMutation = useUpdateAreaStatus();
  const deleteAreaMutation = useDeleteArea();
  const updateGroupStatusMutation = useUpdateGroupStatus();
  const deleteGroupMutation = useDeleteGroup();

  const [areaDlg, setAreaDlg] = useState<{ open: boolean; area?: Area | null; readOnly?: boolean }>({
    open: false,
    area: null,
  });
  const [groupDlg, setGroupDlg] = useState<{ group: SalesGroup | null } | null>(null);
  const [transferDlg, setTransferDlg] = useState<{ open: boolean; staffName?: string }>({
    open: false,
  });

  // Action Dialog States
  const [warningModal, setWarningModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    extraContent?: React.ReactNode;
  }>({ open: false, title: '', message: '' });

  const [deactivateAreaTarget, setDeactivateAreaTarget] = useState<Area | null>(null);
  const [reactivateAreaTarget, setReactivateAreaTarget] = useState<Area | null>(null);
  const [isCheckingArea, setIsCheckingArea] = useState(false);
  const [deleteAreaTarget, setDeleteAreaTarget] = useState<Area | null>(null);

  const [deactivateGroupTarget, setDeactivateGroupTarget] = useState<SalesGroup | null>(null);
  const [reactivateGroupTarget, setReactivateGroupTarget] = useState<SalesGroup | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<SalesGroup | null>(null);

  const manageRegions = can(user, 'regions.manage');
  const manageGroups = can(user, 'salesGroups.manage');
  const assignTerritory = can(user, 'territory.assign');

  const openGroup = (group: SalesGroup | null) => {
    if (!manageGroups) return;
    setGroupDlg({ group });
  };

  const handleDeactivateAreaClick = async (area: Area) => {
    setIsCheckingArea(true);
    try {
      const { activeGroups } = await regionApi.getSalesGroupsForRegion(area.id || area.code);
      if (activeGroups.length > 0) {
        setWarningModal({
          open: true,
          title: 'Không thể ngừng hoạt động khu vực',
          message:
            'Không thể ngừng hoạt động khu vực này vì vẫn còn nhóm Sales đang hoạt động.',
          extraContent: (
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                background: '#FEF3F2',
                borderRadius: 6,
                border: '1px solid #FECDCA',
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 600, color: '#B42318', marginBottom: 6 }}>
                Các nhóm bán hàng đang hoạt động ({activeGroups.length}):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {activeGroups.map((g) => (
                  <span
                    key={g.id || g.code}
                    style={{
                      background: '#FFFFFF',
                      color: '#B42318',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      border: '1px solid #FDA29B',
                    }}
                  >
                    {g.code || g.name}
                  </span>
                ))}
              </div>
            </div>
          ),
        });
        return;
      }

      setDeactivateAreaTarget(area);
    } catch {
      setWarningModal({
        open: true,
        title: 'Không thể ngừng hoạt động khu vực',
        message:
          'Không thể kiểm tra trạng thái các nhóm bán hàng trực thuộc. Vui lòng thử lại sau.',
      });
    } finally {
      setIsCheckingArea(false);
    }
  };

  const handleConfirmDeactivateArea = async () => {
    if (!deactivateAreaTarget) return;
    try {
      await updateAreaStatusMutation.mutateAsync({
        idOrCode: deactivateAreaTarget.id || deactivateAreaTarget.code,
        isActive: false,
      });
      toast.show('Đã ngừng hoạt động vùng.');
      setDeactivateAreaTarget(null);
    } catch {
      toast.show('Không thể hoàn tất thao tác. Vui lòng thử lại.');
      setDeactivateAreaTarget(null);
    }
  };

  const handleConfirmReactivateArea = async () => {
    if (!reactivateAreaTarget) return;
    try {
      await updateAreaStatusMutation.mutateAsync({
        idOrCode: reactivateAreaTarget.id || reactivateAreaTarget.code,
        isActive: true,
      });
      toast.show('Đã kích hoạt lại vùng.');
      setReactivateAreaTarget(null);
    } catch {
      toast.show('Không thể hoàn tất thao tác. Vui lòng thử lại.');
      setReactivateAreaTarget(null);
    }
  };

  const handleConfirmDeleteArea = async () => {
    if (!deleteAreaTarget) return;
    try {
      if (deleteAreaTarget.groups && deleteAreaTarget.groups.length > 0) {
        toast.show('Không thể xóa vùng vì vẫn còn nhóm bán hàng thuộc vùng này.');
        setDeleteAreaTarget(null);
        return;
      }
      await deleteAreaMutation.mutateAsync(deleteAreaTarget.id || deleteAreaTarget.code);
      toast.show('Đã xóa vùng.');
      setDeleteAreaTarget(null);
    } catch {
      toast.show('Không thể xóa vùng vì vẫn còn nhóm bán hàng thuộc vùng này.');
      setDeleteAreaTarget(null);
    }
  };

  const handleConfirmDeactivateGroup = async () => {
    if (!deactivateGroupTarget) return;
    try {
      await updateGroupStatusMutation.mutateAsync({
        idOrCode: deactivateGroupTarget.id || deactivateGroupTarget.code,
        isActive: false,
      });
      toast.show('Đã ngừng hoạt động nhóm bán hàng.');
      setDeactivateGroupTarget(null);
    } catch {
      toast.show('Không thể hoàn tất thao tác. Vui lòng thử lại.');
      setDeactivateGroupTarget(null);
    }
  };

  const handleReactivateGroupClick = (group: SalesGroup) => {
    const parentArea = areas.data?.find(
      (a) =>
        (group.regionId && a.id && a.id.toLowerCase() === group.regionId.toLowerCase()) ||
        (a.code && group.areaCode && a.code.toUpperCase() === group.areaCode.toUpperCase()),
    );

    if (parentArea && parentArea.isActive === false) {
      setWarningModal({
        open: true,
        title: 'Không thể kích hoạt lại nhóm bán hàng',
        message: 'Vùng trực thuộc hiện đang ngừng hoạt động. Vui lòng kích hoạt lại vùng trước khi kích hoạt lại nhóm bán hàng này.',
      });
      return;
    }

    setReactivateGroupTarget(group);
  };

  const handleConfirmReactivateGroup = async () => {
    if (!reactivateGroupTarget) return;
    try {
      await updateGroupStatusMutation.mutateAsync({
        idOrCode: reactivateGroupTarget.id || reactivateGroupTarget.code,
        isActive: true,
      });
      toast.show('Đã kích hoạt lại nhóm bán hàng.');
      setReactivateGroupTarget(null);
    } catch {
      toast.show('Không thể hoàn tất thao tác. Vui lòng thử lại.');
      setReactivateGroupTarget(null);
    }
  };

  const handleConfirmDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    try {
      if (deleteGroupTarget.members && deleteGroupTarget.members.length > 0) {
        toast.show('Không thể xóa nhóm bán hàng vì vẫn còn nhân viên đang được phân công.');
        setDeleteGroupTarget(null);
        return;
      }
      await deleteGroupMutation.mutateAsync(deleteGroupTarget.id || deleteGroupTarget.code);
      toast.show('Đã xóa nhóm bán hàng.');
      setDeleteGroupTarget(null);
    } catch {
      toast.show('Không thể xóa nhóm bán hàng vì vẫn còn nhân viên đang được phân công.');
      setDeleteGroupTarget(null);
    }
  };

  const groupColumns: Column<SalesGroup>[] = [
    {
      key: 'code',
      header: 'Mã nhóm',
      width: '110px',
      render: (group) => <span className="bold">{group.code}</span>,
      text: (group) => group.code,
    },
    {
      key: 'area',
      header: 'Khu vực',
      width: '140px',
      render: (group) => <span>{group.areaName}</span>,
      text: (group) => group.areaName,
    },
    {
      key: 'manager',
      header: 'Sales Manager',
      width: '160px',
      render: (group) => (
        <div>
          <span style={{ fontWeight: 600 }}>{group.managerName}</span>
          <div className="muted small">Quản lý khu vực</div>
        </div>
      ),
      text: (group) => group.managerName,
    },
    {
      key: 'members',
      header: 'Phân công nhân viên trong nhóm',
      render: (group) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {group.members.map((m) => (
              <span
                key={m}
                style={{
                  display: 'inline-block',
                  background: '#EEF2EC',
                  color: '#1B1F1D',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 500,
                  border: '1px solid #DCE1DA',
                }}
              >
                {m}
              </span>
            ))}
          </div>
          <span className="muted small" style={{ fontSize: 11.5 }}>
            Tổng cộng: <b>{group.members.length}</b> nhân viên
          </span>
        </div>
      ),
      text: (group) => `${group.members.join(', ')} (${group.members.length} nhân viên)`,
    },
    {
      key: 'retailers',
      header: 'Điểm bán',
      width: '120px',
      align: 'right',
      render: (group) => <span>{group.retailerCount} điểm bán</span>,
      text: (group) => `${group.retailerCount}`,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '125px',
      align: 'center',
      render: (group) => (
        <StatusChip value={group.isActive !== false ? 'Hoạt động' : 'Tạm ngừng'} />
      ),
      text: (group) => (group.isActive !== false ? 'Đang hoạt động' : 'Tạm ngừng'),
    },
  ];

  const areaColumns: Column<Area>[] = [
    {
      key: 'code',
      header: 'Mã vùng',
      width: '110px',
      render: (area) => <span className="bold">{area.code}</span>,
      text: (area) => area.code,
    },
    {
      key: 'name',
      header: 'Tên vùng',
      width: '160px',
      render: (area) => <span style={{ fontWeight: 600 }}>{area.name}</span>,
      text: (area) => area.name,
    },
    {
      key: 'manager',
      header: 'Sales Manager',
      width: '160px',
      render: (area) => (
        <div>
          <span style={{ fontWeight: 600 }}>{area.managerName}</span>
          <div className="muted small">Giám sát khu vực</div>
        </div>
      ),
      text: (area) => area.managerName,
    },
    {
      key: 'description',
      header: 'Mô tả / Phạm vi',
      render: (area) => (
        <span className="small muted">
          {area.description || '— Chưa khai báo'}
        </span>
      ),
      text: (area) => area.description || '',
    },
    {
      key: 'groups',
      header: 'Nhóm trực thuộc',
      width: '160px',
      render: (area) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {area.groups.map((g) => (
            <span
              key={g}
              style={{
                background: '#E2E8F0',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {g}
            </span>
          ))}
        </div>
      ),
      text: (area) => area.groups.join(', '),
    },
    {
      key: 'retailers',
      header: 'Điểm bán',
      width: '120px',
      align: 'right',
      render: (area) => <span>{area.retailerCount} điểm bán</span>,
      text: (area) => `${area.retailerCount}`,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '125px',
      align: 'center',
      render: (area) => (
        <StatusChip value={area.isActive !== false ? 'Hoạt động' : 'Tạm ngừng'} />
      ),
      text: (area) => (area.isActive !== false ? 'Đang hoạt động' : 'Tạm ngừng'),
    },
  ];

  return (
    <>
      <PageHeader
        title="Khu vực & nhóm bán hàng"
        subtitle="Quản lý khu vực địa lý, nhóm phụ trách và phân công nhân sự."
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          {
            key: 'groups',
            label: 'Nhóm bán hàng',
            count: groups.data?.length,
          },
          {
            key: 'areas',
            label: 'Vùng hoạt động',
            count: areas.data?.length,
          },
        ]}
      />

      {tab === 'groups' ? (
        <DataTable
          key="groups"
          title="Danh sách nhóm bán hàng"
          rows={groups.data}
          loading={groups.isLoading}
          error={groups.error}
          rowKey={(group) => group.code}
          columns={groupColumns}
          searchPlaceholder="Mã nhóm, khu vực, Sales Manager, tên nhân viên…"
          filters={[
            {
              label: 'Khu vực',
              options: [
                ...new Set((groups.data ?? []).map((group) => group.areaName)),
              ],
              value: (group) => group.areaName,
            },
            {
              label: 'Trạng thái',
              options: ['Đang hoạt động', 'Tạm ngừng'],
              value: (group) => (group.isActive !== false ? 'Đang hoạt động' : 'Tạm ngừng'),
            },
          ]}
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              {assignTerritory && (
                <Button onClick={() => setTransferDlg({ open: true })}>
                  Chuyển nhân sự
                </Button>
              )}
              {manageGroups && (
                <Button variant="primary" onClick={() => openGroup(null)}>
                  + Thêm nhóm
                </Button>
              )}
            </div>
          }
          onRowClick={(group) => navigate(`/regions/${group.code}`)}
          rowActionsWidth="135px"
          rowActionHeader="Thao tác"
          rowActions={(group) => {
            const dropdownItems: ActionDropdownItem[] = [];

            if (manageGroups) {
              dropdownItems.push({
                key: 'edit',
                label: 'Chỉnh sửa',
                icon: <Pencil size={14} style={{ color: '#1D4ED8' }} />,
                color: '#1D4ED8',
                onClick: () => openGroup(group),
                title: 'Chỉnh sửa thông tin nhóm',
              });
            }

            if (assignTerritory) {
              dropdownItems.push({
                key: 'transfer',
                label: 'Điều chuyển nhân sự',
                icon: <ArrowRightLeft size={14} style={{ color: '#475569' }} />,
                color: '#334155',
                onClick: () =>
                  setTransferDlg({
                    open: true,
                  }),
                title: 'Điều chuyển nhân viên sang nhóm khác',
              });
            }

            if (manageGroups) {
              if (group.isActive !== false) {
                dropdownItems.push({
                  key: 'deactivate',
                  label: 'Ngừng hoạt động',
                  icon: <Pause size={14} style={{ color: '#C2410C' }} />,
                  color: '#C2410C',
                  onClick: () => setDeactivateGroupTarget(group),
                  title: 'Ngừng hoạt động nhóm bán hàng',
                });
              } else {
                dropdownItems.push({
                  key: 'reactivate',
                  label: 'Kích hoạt lại',
                  icon: <Play size={14} style={{ color: '#15803D' }} />,
                  color: '#15803D',
                  onClick: () => handleReactivateGroupClick(group),
                  title: 'Kích hoạt lại nhóm bán hàng',
                });
              }

              dropdownItems.push({
                key: 'delete',
                label: 'Xóa',
                icon: <Trash2 size={14} style={{ color: '#B42318' }} />,
                color: '#B42318',
                onClick: () => setDeleteGroupTarget(group),
                title: 'Xóa nhóm bán hàng',
              });
            }

            return (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  justifyContent: 'flex-end',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => navigate(`/regions/${group.code}`)}
                  title="Xem chi tiết nhóm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    fontSize: 12,
                    fontWeight: 600,
                    height: 30,
                  }}
                >
                  <Eye size={14} />
                  <span>Xem</span>
                </Button>

                {dropdownItems.length > 0 && (
                  <ActionDropdown items={dropdownItems} />
                )}
              </div>
            );
          }}
        />
      ) : (
        <DataTable
          key="areas"
          title="Danh sách vùng hoạt động"
          rows={areas.data}
          loading={areas.isLoading}
          error={areas.error}
          rowKey={(area) => area.code}
          columns={areaColumns}
          onRowClick={(area) => setAreaDlg({ open: true, area, readOnly: true })}
          searchPlaceholder="Mã, tên vùng, Sales Manager, mô tả…"
          filters={[
            {
              label: 'Trạng thái',
              options: ['Đang hoạt động', 'Tạm ngừng'],
              value: (area) => (area.isActive !== false ? 'Đang hoạt động' : 'Tạm ngừng'),
            },
          ]}
          actions={
            manageRegions ? (
              <Button
                variant="primary"
                onClick={() => setAreaDlg({ open: true, area: null, readOnly: false })}
              >
                + Thêm vùng
              </Button>
            ) : undefined
          }
          rowActionsWidth="135px"
          rowActionHeader="Thao tác"
          rowActions={(area) => {
            const dropdownItems: ActionDropdownItem[] = [];

            if (manageRegions) {
              dropdownItems.push({
                key: 'edit',
                label: 'Chỉnh sửa',
                icon: <Pencil size={14} style={{ color: '#1D4ED8' }} />,
                color: '#1D4ED8',
                onClick: () => setAreaDlg({ open: true, area, readOnly: false }),
                title: 'Chỉnh sửa thông tin vùng',
              });

              if (area.isActive !== false) {
                dropdownItems.push({
                  key: 'deactivate',
                  label: 'Ngừng hoạt động',
                  icon: <Pause size={14} style={{ color: '#C2410C' }} />,
                  color: '#C2410C',
                  onClick: () => void handleDeactivateAreaClick(area),
                  disabled: isCheckingArea,
                  title: 'Ngừng hoạt động vùng',
                });
              } else {
                dropdownItems.push({
                  key: 'reactivate',
                  label: 'Kích hoạt lại',
                  icon: <Play size={14} style={{ color: '#15803D' }} />,
                  color: '#15803D',
                  onClick: () => setReactivateAreaTarget(area),
                  title: 'Kích hoạt lại vùng',
                });
              }

              dropdownItems.push({
                key: 'delete',
                label: 'Xóa',
                icon: <Trash2 size={14} style={{ color: '#B42318' }} />,
                color: '#B42318',
                onClick: () => setDeleteAreaTarget(area),
                title: 'Xóa vùng',
              });
            }

            return (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  justifyContent: 'flex-end',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setAreaDlg({ open: true, area, readOnly: true })}
                  title="Xem chi tiết vùng"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    fontSize: 12,
                    fontWeight: 600,
                    height: 30,
                  }}
                >
                  <Eye size={14} />
                  <span>Xem</span>
                </Button>

                {dropdownItems.length > 0 && (
                  <ActionDropdown items={dropdownItems} />
                )}
              </div>
            );
          }}
        />
      )}

      {(manageRegions || areaDlg.readOnly) && (
        <AreaDialog
          open={areaDlg.open}
          area={areaDlg.area}
          readOnly={areaDlg.readOnly}
          onClose={() => setAreaDlg({ open: false, area: null })}
        />
      )}

      {manageGroups && (
        <GroupDialog
          open={groupDlg !== null}
          group={groupDlg?.group}
          onClose={() => setGroupDlg(null)}
        />
      )}

      {assignTerritory && (
        <TransferStaffDialog
          open={transferDlg.open}
          initialStaffName={transferDlg.staffName}
          onClose={() => setTransferDlg({ open: false })}
        />
      )}

      {/* Warning Modal for Blocked Deactivation / Reactivation */}
      <Modal
        open={warningModal.open}
        title={warningModal.title}
        width={480}
        onClose={() => setWarningModal((prev) => ({ ...prev, open: false }))}
        footer={
          <Button
            variant="primary"
            onClick={() => setWarningModal((prev) => ({ ...prev, open: false }))}
          >
            Đã hiểu
          </Button>
        }
      >
        <div style={{ lineHeight: 1.6, fontSize: 13.5 }}>{warningModal.message}</div>
        {warningModal.extraContent}
      </Modal>

      {/* Confirm Region Deactivation */}
      <ConfirmDialog
        open={Boolean(deactivateAreaTarget)}
        title="Ngừng hoạt động vùng"
        message="Bạn có chắc chắn muốn ngừng hoạt động vùng này không? Các thông tin hiện có vẫn được giữ lại, nhưng vùng sẽ không được sử dụng cho các phân công mới."
        confirmLabel="Ngừng hoạt động"
        confirmVariant="deactivate"
        onClose={() => setDeactivateAreaTarget(null)}
        onConfirm={handleConfirmDeactivateArea}
      />

      {/* Confirm Region Reactivation */}
      <ConfirmDialog
        open={Boolean(reactivateAreaTarget)}
        title="Kích hoạt lại vùng"
        message="Bạn có chắc chắn muốn kích hoạt lại vùng này không? Vùng sẽ sẵn sàng để sử dụng lại cho các hoạt động và phân công mới."
        confirmLabel="Kích hoạt lại vùng"
        confirmVariant="primary"
        onClose={() => setReactivateAreaTarget(null)}
        onConfirm={handleConfirmReactivateArea}
      />

      {/* Confirm Region Deletion */}
      <ConfirmDialog
        open={Boolean(deleteAreaTarget)}
        title="Xóa vùng"
        message="Bạn có chắc chắn muốn xóa vùng này không? Hãy kiểm tra các nhóm bán hàng đang thuộc vùng trước khi tiếp tục."
        confirmLabel="Xóa vùng"
        danger
        onClose={() => setDeleteAreaTarget(null)}
        onConfirm={handleConfirmDeleteArea}
      />

      {/* Confirm Sales Group Deactivation */}
      <ConfirmDialog
        open={Boolean(deactivateGroupTarget)}
        title="Ngừng hoạt động nhóm bán hàng"
        message="Bạn có chắc chắn muốn ngừng hoạt động nhóm bán hàng này không? Các nhân viên đang thuộc nhóm vẫn được giữ nguyên, nhưng nhóm sẽ không nhận thêm phân công mới."
        confirmLabel="Ngừng hoạt động"
        confirmVariant="deactivate"
        onClose={() => setDeactivateGroupTarget(null)}
        onConfirm={handleConfirmDeactivateGroup}
      />

      {/* Confirm Sales Group Reactivation */}
      <ConfirmDialog
        open={Boolean(reactivateGroupTarget)}
        title="Kích hoạt lại nhóm bán hàng"
        message="Bạn có chắc chắn muốn kích hoạt lại nhóm bán hàng này không? Nhóm sẽ sẵn sàng để sử dụng lại và tiếp nhận các phân công mới."
        confirmLabel="Kích hoạt lại nhóm bán hàng"
        confirmVariant="primary"
        onClose={() => setReactivateGroupTarget(null)}
        onConfirm={handleConfirmReactivateGroup}
      />

      {/* Confirm Sales Group Deletion */}
      <ConfirmDialog
        open={Boolean(deleteGroupTarget)}
        title="Xóa nhóm bán hàng"
        message="Bạn có chắc chắn muốn xóa nhóm bán hàng này không? Hãy kiểm tra các nhân viên đang thuộc nhóm trước khi tiếp tục."
        confirmLabel="Xóa nhóm"
        danger
        onClose={() => setDeleteGroupTarget(null)}
        onConfirm={handleConfirmDeleteGroup}
      />
    </>
  );
}
