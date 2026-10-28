import { can } from '@/shared/auth/permissions';
import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, DataTable, PageHeader, StatusChip, type Column } from '@/shared/ui';
import { statusLabels } from '@/shared/lib';
import { useAuth } from '@/shared/auth/AuthContext';
import { useRetailerRows } from '../hooks';
import { RegistrationActions } from '../components/RegistrationActions';
import { RetailerFormDialog } from '../components/RetailerFormDialog';
import type { RetailerRow } from '../types';

const statusText = (r: RetailerRow) => (r.statusDomain === 'active' ? statusLabels.active[r.status as 'Active' | 'Locked'] : statusLabels.registration[r.status as 'Pending' | 'Rejected']);

/** "Retailer" – master list plus Sales registrations (KB-xxxx) waiting for approval. */
export function RetailersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mayCreate = can(user, 'retailers.create');
  const query = useRetailerRows();
  const [creating, setCreating] = useState(false);
  const columns: Column<RetailerRow>[] = [
    { key: 'code', header: 'Mã', width: '110px', render: (r) => <span className="bold">{r.code}</span> },
    { key: 'name', header: 'Tên điểm bán', text: (r) => r.name },
    { key: 'address', header: 'Địa chỉ', text: (r) => r.address },
    { key: 'area', header: 'Khu vực', width: '110px', text: (r) => r.areaName },
    { key: 'contact', header: 'Liên hệ', width: '150px', text: (r) => `${r.contact} ${r.phone}`, render: (r) => (<><div>{r.contact || '—'}</div><div className="muted small">{r.phone}</div></>) },
    { key: 'class', header: 'Nhóm tiềm năng', width: '100px', render: (r) => <StatusChip value={r.potentialClass} /> },
    { key: 'source', header: 'Nguồn', width: '170px', text: (r) => r.source },
    { key: 'status', header: 'Trạng thái', width: '115px', render: (r) => <StatusChip value={statusText(r)} /> },
  ];
  return (
    <>
      <PageHeader title="Retailer" subtitle="Danh sách điểm bán và khai báo mới từ Sales (mã KB-xxxx) chờ duyệt." />
      <DataTable
        title="Danh sách retailer"
        rows={query.data}
        loading={query.isLoading}
        error={query.error}
        rowKey={(r) => r.code}
        columns={columns}
        searchPlaceholder="Mã, tên, địa chỉ, liên hệ…"
        filters={[
          { label: 'Trạng thái', options: ['Hoạt động', 'Đã khóa', 'Chờ duyệt', 'Bị từ chối'], value: statusText },
          { label: 'Khu vực', options: [...new Set((query.data ?? []).map((r) => r.areaName))], value: (r) => r.areaName },
          { label: 'Nhóm tiềm năng', options: ['A', 'B', 'C'], value: (r) => r.potentialClass },
        ]}
        actions={
          mayCreate ? (
            <Button
              variant="primary"
              onClick={() => setCreating(true)}
            >
              + Tạo retailer
            </Button>
          ) : undefined
        }
        onRowClick={(r) => navigate(`/retailers/${r.code}`)}
        rowActionsWidth="230px"
        rowActions={(r) => (
          <>
            <Button size="sm" onClick={() => navigate(`/retailers/${r.code}`)}>Xem</Button>
            {r.kind === 'Registration' && r.status === 'Pending' && <RegistrationActions code={r.code} />}
          </>
        )}
      />
      {mayCreate && creating && (
        <RetailerFormDialog
          open
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}
