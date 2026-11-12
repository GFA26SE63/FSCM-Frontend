import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { get, post } from '@/shared/api/http';
import { Callout, ConfirmDialog, FormDialog } from '@/shared/ui';

type Retailer = { id: string; code: string; name: string; contactName?: string; phone?: string; address?: string; status: string; retailerType: string; salesGroupCode: string; creditTermDays: number };
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

export function RetailerReviewDialog({ retailer, onClose }: { retailer: Pick<Retailer, 'id' | 'code'>; onClose: () => void }) {
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
      await client.invalidateQueries({ queryKey: ['retailer'] });
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


