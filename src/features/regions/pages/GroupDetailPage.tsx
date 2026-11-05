import { useState } from 'react';
import { useNavigate, useParams } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import {
  Button,
  Card,
  ConfirmDialog,
  Fields,
  Modal,
  PageHeader,
  QueryState,
  SimpleTable,
  StatusChip,
  useToast,
} from '@/shared/ui';
import { formatMoney } from '@/shared/lib';
import {
  useAreas,
  useDeleteGroup,
  useGroup,
  useGroupRetailers,
  useUpdateGroupStatus,
} from '../hooks';
import { GroupDialog, TransferStaffDialog } from '../components/RegionDialogs';

export function GroupDetailPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const query = useGroup(code);
  const areasQuery = useAreas();
  const retailersQuery = useGroupRetailers(code);

  const updateGroupStatusMutation = useUpdateGroupStatus();
  const deleteGroupMutation = useDeleteGroup();

  const [edit, setEdit] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);

  // Dialog states
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [reactivateConfirm, setReactivateConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [warningModal, setWarningModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: '', message: '' });

  const manageGroups = can(user, 'salesGroups.manage');
  const assignTerritory = can(user, 'territory.assign');
  const mayOpenRetailers = user?.role === 'Admin' || user?.role === 'Operator';

  const handleOpenReactivate = () => {
    const g = query.data;
    if (!g) return;

    const parentArea = areasQuery.data?.find(
      (a) =>
        (g.regionId && a.id && a.id.toLowerCase() === g.regionId.toLowerCase()) ||
        (a.code && g.areaCode && a.code.toUpperCase() === g.areaCode.toUpperCase()),
    );

    if (parentArea && parentArea.isActive === false) {
      setWarningModal({
        open: true,
        title: 'Không thể kích hoạt lại nhóm bán hàng',
        message: 'Vùng trực thuộc hiện đang ngừng hoạt động. Vui lòng kích hoạt lại vùng trước khi kích hoạt lại nhóm bán hàng này.',
      });
      return;
    }

    setReactivateConfirm(true);
  };

  const handleConfirmReactivate = async () => {
    const g = query.data;
    if (!g) return;
    try {
      await updateGroupStatusMutation.mutateAsync({
        idOrCode: g.id || g.code,
        isActive: true,
      });
      toast.show('Đã kích hoạt lại nhóm bán hàng.');
      setReactivateConfirm(false);
    } catch {
      toast.show('Không thể hoàn tất thao tác. Vui lòng thử lại.');
      setReactivateConfirm(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    const g = query.data;
    if (!g) return;
    try {
      await updateGroupStatusMutation.mutateAsync({
        idOrCode: g.id || g.code,
        isActive: false,
      });
      toast.show('Đã ngừng hoạt động nhóm bán hàng.');
      setDeactivateConfirm(false);
    } catch {
      toast.show('Không thể hoàn tất thao tác. Vui lòng thử lại.');
      setDeactivateConfirm(false);
    }
  };

  const handleConfirmDelete = async () => {
    const g = query.data;
    if (!g) return;
    try {
      if (g.members && g.members.length > 0) {
        toast.show('Không thể xóa nhóm bán hàng vì vẫn còn nhân viên đang được phân công.');
        setDeleteConfirm(false);
        return;
      }
      await deleteGroupMutation.mutateAsync(g.id || g.code);
      toast.show('Đã xóa nhóm bán hàng.');
      setDeleteConfirm(false);
      navigate('/regions');
    } catch {
      toast.show('Không thể xóa nhóm bán hàng vì vẫn còn nhân viên đang được phân công.');
      setDeleteConfirm(false);
    }
  };

  return (
    <QueryState query={query}>
      {(g) => (
        <>
          <PageHeader
            back="/regions"
            title={`Nhóm ${g.code}`}
            subtitle={`Khu vực ${g.areaName} · Giám sát bởi ${g.managerName}`}
            actions={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <StatusChip
                  value={g.isActive !== false ? 'Hoạt động' : 'Tạm ngừng'}
                />
                {assignTerritory && (
                  <Button onClick={() => setTransferTarget(g.members[0] ?? '')}>
                    Chuyển nhân sự
                  </Button>
                )}
                {manageGroups && (
                  <Button onClick={() => setEdit(true)}>
                    Sửa nhóm
                  </Button>
                )}
                {manageGroups && (
                  g.isActive !== false ? (
                    <Button
                      variant="deactivate"
                      onClick={() => setDeactivateConfirm(true)}
                    >
                      Ngừng hoạt động
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={handleOpenReactivate}
                    >
                      Kích hoạt lại nhóm bán hàng
                    </Button>
                  )
                )}
                {manageGroups && (
                  <Button
                    variant="danger"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    Xóa nhóm
                  </Button>
                )}
              </div>
            }
          />

          <Card>
            <Fields
              cols={3}
              items={[
                { label: 'Mã nhóm', value: g.code },
                { label: 'Khu vực', value: `${g.areaName} (${g.areaCode})` },
                { label: 'Sales Manager', value: g.managerName },
                {
                  label: 'Trạng thái',
                  value: (
                    <StatusChip
                      value={g.isActive !== false ? 'Hoạt động' : 'Tạm ngừng'}
                    />
                  ),
                },
                { label: 'Số nhân viên phụ trách', value: `${g.members.length} nhân viên` },
                { label: 'Số điểm bán phụ trách', value: `${g.retailerCount} điểm bán` },
              ]}
            />
          </Card>

          <Card title={`Thành viên & Doanh số tháng (${g.memberRows?.length ?? g.members.length} nhân viên)`} flush>
            <SimpleTable
              rows={
                g.memberRows?.length
                  ? g.memberRows
                  : g.members.map((m) => ({
                    name: m,
                    groupCode: g.code,
                    revenueAfterPromo: 0,
                    revenueBeforePromo: 0,
                  }))
              }
              empty="Chưa có nhân viên nào trong nhóm này."
              columns={[
                {
                  header: 'Nhân viên',
                  cell: (m) => <span style={{ fontWeight: 600 }}>{m.name}</span>,
                },
                {
                  header: 'Nhóm phụ trách',
                  cell: () => <span>{g.code}</span>,
                },
                {
                  header: 'Doanh thu sau KM',
                  align: 'right',
                  cell: (m) => formatMoney(m.revenueAfterPromo),
                },
                {
                  header: 'Doanh thu trước KM',
                  align: 'right',
                  cell: (m) => formatMoney(m.revenueBeforePromo),
                },
                {
                  header: 'Thao tác',
                  align: 'center',
                  cell: (m) =>
                    assignTerritory ? (
                      <Button
                        size="sm"
                        onClick={() => setTransferTarget(m.name)}
                      >
                        Chuyển nhóm
                      </Button>
                    ) : null,
                },
              ]}
            />
          </Card>

          <Card
            title={`Danh sách điểm bán do nhóm ${g.code} phụ trách (${retailersQuery.data?.length ?? g.retailerCount} điểm bán)`}
            flush
          >
            <SimpleTable
              rows={retailersQuery.data ?? []}
              empty="Chưa có điểm bán nào được phân công cho nhóm này."
              columns={[
                {
                  header: 'Mã điểm bán',
                  cell: (r) => mayOpenRetailers ? (
                    <a
                      href={`/retailers/${r.code}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/retailers/${r.code}`);
                      }}
                      style={{ fontWeight: 600 }}
                    >
                      {r.code}
                    </a>
                  ) : <span style={{ fontWeight: 600 }}>{r.code}</span>,
                },
                {
                  header: 'Tên điểm bán',
                  cell: (r) => r.name,
                },
                {
                  header: 'Địa chỉ',
                  cell: (r) => r.address,
                },
                {
                  header: 'Liên hệ',
                  cell: (r) => `${r.contact || '—'} (${r.phone})`,
                },
                {
                  header: 'Quy mô',
                  align: 'center',
                  cell: (r) => r.size || '—',
                },
                {
                  header: 'Tiềm năng',
                  align: 'center',
                  cell: (r) => (r.potentialClass ? <StatusChip value={r.potentialClass} /> : '—'),
                },
                {
                  header: 'Trạng thái',
                  align: 'center',
                  cell: (r) => <StatusChip domain="active" value={r.status} />,
                },
              ]}
            />
          </Card>

          {manageGroups && (
            <GroupDialog open={edit} group={g} onClose={() => setEdit(false)} />
          )}

          {assignTerritory && (
            <TransferStaffDialog
              open={transferTarget !== null}
              initialStaffName={transferTarget ?? undefined}
              onClose={() => setTransferTarget(null)}
            />
          )}

          {/* Warning Modal for Blocked Group Reactivation */}
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
          </Modal>

          {/* Confirm Sales Group Deactivation */}
          <ConfirmDialog
            open={deactivateConfirm}
            title="Ngừng hoạt động nhóm bán hàng"
            message="Bạn có chắc chắn muốn ngừng hoạt động nhóm bán hàng này không? Các nhân viên đang thuộc nhóm vẫn được giữ nguyên, nhưng nhóm sẽ không nhận thêm phân công mới."
            confirmLabel="Ngừng hoạt động"
            confirmVariant="deactivate"
            onClose={() => setDeactivateConfirm(false)}
            onConfirm={handleConfirmDeactivate}
          />

          {/* Confirm Sales Group Reactivation */}
          <ConfirmDialog
            open={reactivateConfirm}
            title="Kích hoạt lại nhóm bán hàng"
            message="Bạn có chắc chắn muốn kích hoạt lại nhóm bán hàng này không? Nhóm sẽ sẵn sàng để sử dụng lại và tiếp nhận các phân công mới."
            confirmLabel="Kích hoạt lại nhóm bán hàng"
            confirmVariant="primary"
            onClose={() => setReactivateConfirm(false)}
            onConfirm={handleConfirmReactivate}
          />

          {/* Confirm Sales Group Deletion */}
          <ConfirmDialog
            open={deleteConfirm}
            title="Xóa nhóm bán hàng"
            message="Bạn có chắc chắn muốn xóa nhóm bán hàng này không? Hãy kiểm tra các nhân viên đang thuộc nhóm trước khi tiếp tục."
            confirmLabel="Xóa nhóm"
            danger
            onClose={() => setDeleteConfirm(false)}
            onConfirm={handleConfirmDelete}
          />
        </>
      )}
    </QueryState>
  );
}
