import { useState } from 'react';
import { useNavigate, useParams } from '@/shared/router/compat';
import { Button, Callout, Card, Fields, PageHeader, QueryState, StatusChip } from '@/shared/ui';
import { formatDateTime } from '@/shared/lib';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useComplaint, useComplaintEvidence } from '../hooks';
import { ResolveDialog } from '../components/ResolveDialog';

export function ComplaintDetailPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const query = useComplaint(code);
  const [resolving, setResolving] = useState(false);
  const { user } = useAuth();
  const mayRefund = can(user, 'refunds.manage');
  const evidence = useComplaintEvidence(query.data?.id);
  return (
    <QueryState query={query}>
      {(c) => (
        <>
          <PageHeader back="/complaints" title={`Khiếu nại ${c.code}`} subtitle={c.retailerName} chips={<StatusChip domain="complaint" value={c.reviewStatus === 'UnderReview' ? 'UnderReview' : c.status} />} actions={c.status === 'Open' && can(user, 'complaints.resolve') ? <Button variant="primary" onClick={() => setResolving(true)}>Xử lý</Button> : undefined} />
          <Card>
            <Fields cols={3} items={[
              { label: 'Đơn hàng', value: <a href={`/orders/${c.salesOrderId}`} onClick={(e) => { e.preventDefault(); navigate(`/orders/${c.salesOrderId}`); }}>{c.orderCode}</a> },
              { label: 'Retailer', value: `${c.retailerName} (${c.retailerCode})` },
              { label: 'Thời gian gửi', value: formatDateTime(c.createdAt) },
            ]} />
          </Card>
          <Card title="Nội dung khiếu nại">
            <Fields cols={3} items={[
              { label: 'Sản phẩm', value: `${c.sku} · ${c.productName}` },
              { label: 'Loại vấn đề', value: c.issueType === 'Damaged' ? 'Hàng hỏng' : 'Thiếu hàng' },
              { label: 'Tem hàng', value: c.labelCode ?? '—' },
              { label: 'Số lượng dự kiến', value: c.expectedQuantity },
              { label: 'Số lượng sử dụng được', value: c.actualQuantity },
              { label: 'Giá trị điều chỉnh dự kiến', value: `${c.adjustmentAmount.toLocaleString('vi-VN')}đ` },
              { label: 'Mô tả', value: c.note ?? '—' },
              { label: 'Bằng chứng', value: c.evidenceUrl ? <a href={c.evidenceUrl} target="_blank" rel="noreferrer">Mở bằng chứng</a> : 'Chưa có' },
            ]} />
          </Card>
          {c.reviewStatus === 'UnderReview' && <Callout tone="warn"><b>Đã yêu cầu bổ sung bằng chứng:</b> {c.evidenceRequestReason ?? '—'}</Callout>}
          {c.resolutionType === 'FinancialAdjustment' && (
            <Callout tone="ok">
              <b>Phương án giải quyết:</b> hoàn tiền / điều chỉnh tài chính · Giá net {c.finalUnitPrice.toLocaleString('vi-VN')}đ × {c.expectedQuantity - c.actualQuantity} = {c.adjustmentAmount.toLocaleString('vi-VN')}đ
              {mayRefund && <> · <a href="/refunds" onClick={(e) => { e.preventDefault(); navigate('/refunds'); }}>Tạo hồ sơ hoàn tiền cho phần thiếu / hỏng</a></>}
            </Callout>
          )}
          {c.status === 'Cancelled' && <Callout tone="neutral">Retailer đã hủy khiếu nại này.</Callout>}
          <Card title="Bằng chứng đã gửi">
            {evidence.isLoading ? 'Đang tải…' : (evidence.data ?? []).length === 0 && !c.evidenceUrl ? 'Chưa có bằng chứng.' : (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {(evidence.data ?? []).map((e) => (
                  <a key={e.id} href={e.url} target="_blank" rel="noreferrer" title={`${e.fileName} · ${formatDateTime(e.uploadedAt)}`}>
                    <img src={e.url} alt={e.fileName} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border, #ddd)' }} />
                  </a>
                ))}
              </div>
            )}
          </Card>          {c.status !== 'Open' && <Callout tone={c.status === 'Rejected' ? 'danger' : 'ok'}><b>Kết quả xử lý:</b> {c.response ?? '—'}</Callout>}
          <ResolveDialog code={resolving ? c.code : null} onClose={() => setResolving(false)} />
        </>
      )}
    </QueryState>
  );
}
