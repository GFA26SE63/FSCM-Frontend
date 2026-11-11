import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { get, post } from '@/shared/api/http';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import {
  Button,
  Callout,
  ConfirmDialog,
  DataTable,
  FormDialog,
  PageHeader,
  StatusChip,
  type Column,
} from '@/shared/ui';
import { RetailerFormDialog } from '../components/RetailerFormDialog';

type Retailer = {
  id: string;
  code: string;
  name: string;
  contactName?: string;
  phone?: string;
  address?: string;
  status: 'Draft' | 'PendingApproval' | 'Active' | 'Rejected' | 'Inactive' | 'Locked' | string;
  retailerType: string;
  salesGroupCode: string;
  creditTermDays: number;
};

type RetailerDetail = Retailer & {
  email?: string;
  forecastRevenue: number;
  storeSizeSquareMeters: number;
  purchasingCapacity: number;
  purchaseFrequencyPerMonth: number;
  requestedCreditTermDays?: number;
  assessmentNote?: string;
  latitude?: number;
  longitude?: number;
  mlorDeclarations: {
    scope: string;
    categoryName?: string;
    productName?: string;
    minimumLifeRatio: number;
    minimumLifeHours?: number;
  }[];
};

type RetailerPage = { items: Retailer[]; totalCount: number };

const statusLabel: Record<string, string> = {
  Draft: 'Bản nháp',
  PendingApproval: 'Chờ duyệt',
  Active: 'Hoạt động',
  Rejected: 'Từ chối',
  Inactive: 'Ngưng hoạt động',
  Locked: 'Đã khóa',
};

function ReviewDialog({ retailer, onClose }: { retailer: Retailer; onClose: () => void }) {
  const client = useQueryClient();
  const [pendingDecision, setPendingDecision] = useState<{ approve: boolean; creditTermDays: number | null; reason: string } | null>(null);
  const detail = useQuery({ queryKey: ['retailer', retailer.id, 'review'], queryFn: () => get<RetailerDetail>(`/retailers/${retailer.id}`) });
  if (detail.isLoading) return <FormDialog open width={760} title={`Đang tải khai báo ${retailer.code}`} submitLabel="Đang tải" initial={{}} fields={[]} onClose={onClose} onSubmit={() => undefined} />;
  if (detail.error || !detail.data) return <FormDialog open width={760} title={`Không tải được ${retailer.code}`} submitLabel="Đóng" initial={{}} fields={[]} onClose={onClose} onSubmit={onClose} note={<Callout tone="danger">Không thể tải chi tiết khai báo để xét duyệt.</Callout>} />;
  const r = detail.data;
  return <><FormDialog open width={900} columns={3} title={`Xét duyệt khai báo ${r.code}`} subtitle="Kiểm tra toàn bộ thông tin Sales đã khai báo trước khi quyết định." submitLabel="Xác nhận quyết định" initial={{ decision: 'approve', reason: '', creditTermDays: String(r.requestedCreditTermDays ?? r.creditTermDays ?? 0) }} fields={[
    { key: 'name', type: 'info', label: 'Tên điểm bán', info: () => r.name }, { key: 'contact', type: 'info', label: 'Người liên hệ', info: () => r.contactName ?? '—' }, { key: 'phone', type: 'info', label: 'Số điện thoại', info: () => r.phone ?? '—' },
    { key: 'email', type: 'info', label: 'Email', info: () => r.email ?? '—' }, { key: 'address', type: 'info', label: 'Địa chỉ', span: 2, info: () => r.address ?? '—' }, { key: 'salesGroup', type: 'info', label: 'Nhóm Sales', info: () => r.salesGroupCode },
    { key: 'type', type: 'info', label: 'Loại hình', info: () => r.retailerType }, { key: 'area', type: 'info', label: 'Diện tích', info: () => `${r.storeSizeSquareMeters} m²` }, { key: 'capacity', type: 'info', label: 'Sức mua', info: () => `${r.purchasingCapacity} thùng/tháng` },
    { key: 'frequency', type: 'info', label: 'Tần suất mua', info: () => `${r.purchaseFrequencyPerMonth} lần/tháng` }, { key: 'revenue', type: 'info', label: 'Doanh thu dự báo', info: () => new Intl.NumberFormat('vi-VN').format(r.forecastRevenue) + ' đ' }, { key: 'location', type: 'info', label: 'Tọa độ', info: () => r.latitude != null && r.longitude != null ? `${r.latitude}, ${r.longitude}` : '—' },
    { key: 'note', type: 'info', label: 'Ghi chú Sales', span: 3, info: () => r.assessmentNote ?? '—' }, { key: 'mlor', type: 'info', label: 'Khai báo MLOR', span: 3, info: () => r.mlorDeclarations.length ? r.mlorDeclarations.map((item) => `${item.productName ?? item.categoryName ?? item.scope}: ${(item.minimumLifeRatio * 100).toFixed(0)}%${item.minimumLifeHours ? ` · ${item.minimumLifeHours} giờ` : ''}`).join(' | ') : 'Không có' },
    { key: 'decision', type: 'select', label: 'Quyết định', required: true, options: [{ value: 'approve', label: 'Duyệt retailer' }, { value: 'reject', label: 'Từ chối khai báo' }] }, { key: 'creditTermDays', type: 'select', label: 'Kỳ hạn công nợ', required: true, visible: (v) => v.decision === 'approve', options: [{ value: '0', label: 'Không công nợ' }, { value: '7', label: '7 ngày' }, { value: '14', label: '14 ngày' }, { value: '30', label: '30 ngày' }] }, { key: 'reason', type: 'textarea', label: 'Lý do / ghi chú', required: true, span: 3, placeholder: 'Bắt buộc cho cả duyệt và từ chối' },
  ]} onClose={onClose} onSubmit={(value) => {
    const approve = value.decision === 'approve';
    setPendingDecision({ approve, creditTermDays: approve ? Number(value.creditTermDays) : null, reason: value.reason });
  }} />
  <ConfirmDialog
    open={pendingDecision !== null}
    title={pendingDecision?.approve ? 'Xác nhận duyệt và tạo tài khoản Retailer' : 'Xác nhận từ chối khai báo'}
    confirmLabel={pendingDecision?.approve ? 'Duyệt và tạo tài khoản' : 'Xác nhận từ chối'}
    danger={pendingDecision?.approve === false}
    onClose={() => setPendingDecision(null)}
    onConfirm={async () => {
      if (!pendingDecision) return;
      await post(`/retailers/${r.id}/review`, pendingDecision);
      await client.invalidateQueries({ queryKey: ['retailers'] });
      setPendingDecision(null);
      onClose();
    }}
    message={pendingDecision?.approve ? (
      <div style={{ display: 'grid', gap: 10 }}>
        <Callout tone="warn">
          Khi xác nhận, hệ thống sẽ đồng thời tạo tài khoản User Account chưa kích hoạt và gán tài khoản đó cho Retailer này.
        </Callout>
        <dl style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, margin: 0 }}>
          <dt>Retailer</dt><dd style={{ margin: 0 }}>{r.name}</dd>
          <dt>Họ tên</dt><dd style={{ margin: 0 }}>{r.contactName ?? '—'}</dd>
          <dt>Email</dt><dd style={{ margin: 0 }}>{r.email ?? '—'}</dd>
          <dt>Số điện thoại</dt><dd style={{ margin: 0 }}>{r.phone ?? '—'}</dd>
        </dl>
        <p className="muted" style={{ margin: 0 }}>Chủ Retailer sẽ xác minh OTP và tự thiết lập mật khẩu trong lần đăng nhập đầu tiên.</p>
      </div>
    ) : 'Khai báo sẽ bị từ chối và không tạo tài khoản User Account cho Retailer.'}
  /></>;
}

/** Operational retailer queue backed by the current Retailers API. */
export function RetailersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reviewing, setReviewing] = useState<Retailer | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const query = useQuery({
    queryKey: ['retailers', 'portal'],
    queryFn: () => get<RetailerPage>('/retailers', { page: 1, pageSize: 100 }),
  });

  const rows = useMemo(() => query.data?.items ?? [], [query.data?.items]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.salesGroupCode) set.add(r.salesGroupCode);
    });
    return Array.from(set).sort();
  }, [rows]);

  const columns: Column<Retailer>[] = [
    { key: 'code', header: 'Mã', width: '120px', text: (row) => row.code },
    { key: 'name', header: 'Điểm bán', text: (row) => row.name },
    {
      key: 'contact',
      header: 'Liên hệ',
      text: (row) => `${row.contactName ?? '—'} · ${row.phone ?? '—'}`,
    },
    { key: 'salesGroup', header: 'Nhóm Sales', width: '130px', text: (row) => row.salesGroupCode },
    { key: 'type', header: 'Loại hình', text: (row) => row.retailerType },
    {
      key: 'credit',
      header: 'Công nợ',
      width: '110px',
      text: (row) => (row.creditTermDays ? `${row.creditTermDays} ngày` : 'Không'),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '140px',
      render: (row) => <StatusChip value={statusLabel[row.status] || row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Retailer"
        subtitle="Theo dõi khai báo từ Sales, duyệt retailer và quản lý hồ sơ điểm bán."
        actions={
          can(user, 'retailers.create') ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              + Tạo retailer
            </Button>
          ) : undefined
        }
      />
      <DataTable
        title="Danh sách retailer"
        rows={rows}
        loading={query.isLoading}
        error={query.error}
        rowKey={(row) => row.id}
        columns={columns}
        onRowClick={(row) => navigate(`/retailers/${row.id || row.code}`)}
        searchPlaceholder="Mã, tên điểm bán, người liên hệ, SĐT..."
        filters={[
          {
            label: 'Trạng thái',
            options: Object.values(statusLabel),
            value: (row) => statusLabel[row.status] || row.status,
          },
          ...(groups.length > 0
            ? [
                {
                  label: 'Nhóm Sales',
                  options: groups,
                  value: (row: Retailer) => row.salesGroupCode || '—',
                },
              ]
            : []),
        ]}
        rowActionHeader="Thao tác"
        rowActionsWidth="170px"
        rowActions={(row) => (
          <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end', width: '100%' }}>
            <Button
              size="sm"
              variant="default"
              onClick={() => navigate(`/retailers/${row.id || row.code}`)}
            >
              Xem
            </Button>
            {row.status === 'PendingApproval' && can(user, 'retailers.review') && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setReviewing(row)}
              >
                Xét duyệt
              </Button>
            )}
          </div>
        )}
      />
      {reviewing && <ReviewDialog retailer={reviewing} onClose={() => setReviewing(null)} />}
      {createOpen && <RetailerFormDialog open retailer={null} onClose={() => setCreateOpen(false)} />}
    </>
  );
}
