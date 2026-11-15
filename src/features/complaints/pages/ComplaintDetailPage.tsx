import { useState } from 'react';
import { useNavigate, useParams } from '@/shared/router/compat';
import { Button, Callout, Card, Fields, PageHeader, QueryState, StatusChip } from '@/shared/ui';
import { formatDateTime } from '@/shared/lib';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useComplaint, useComplaintEvidence } from '../hooks';
import { ResolveDialog } from '../components/ResolveDialog';
import { CompleteHandlingDialog } from '../components/CompleteHandlingDialog';
import { requestTypeLabel, settlementLabel } from '../types';

export function ComplaintDetailPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const query = useComplaint(code);
  const [resolving, setResolving] = useState(false);
  const [handling, setHandling] = useState(false);
  const { user } = useAuth();
  const mayRefund = can(user, 'refunds.manage');
  const evidence = useComplaintEvidence(query.data?.id);
  return (
    <QueryState query={query}>
      {(c) => (
        <>
          <PageHeader back="/complaints" title={`Yêu cầu ${c.code}`} subtitle={`${requestTypeLabel(c.requestType)} · ${c.retailerName}`} chips={<StatusChip domain="complaint" value={c.reviewStatus === 'UnderReview' ? 'UnderReview' : c.status} />} actions={<>
            {c.status === 'Open' && can(user, 'complaints.resolve') && <Button variant="primary" onClick={() => setResolving(true)}>Xử lý</Button>}
            {c.status === 'Approved' && c.physicalHandlingCompleted && !c.financialAdjustmentApplied && can(user, 'complaints.decide') && <Button variant="primary" onClick={() => setResolving(true)}>Chốt tài chính</Button>}
            {c.status === 'Approved' && c.documents?.some(d => d.status === 'Pending') && can(user, 'complaints.resolve') && <Button variant="primary" onClick={() => setHandling(true)}>Xác nhận xử lý thực tế</Button>}
          </>} />
          <Card>
            <Fields cols={3} items={[
              { label: 'Đơn hàng', value: <a href={`/orders/${c.salesOrderId}`} onClick={(e) => { e.preventDefault(); navigate(`/orders/${c.salesOrderId}`); }}>{c.orderCode}</a> },
              { label: 'Retailer', value: `${c.retailerName} (${c.retailerCode})` },
              { label: 'Thời gian gửi', value: formatDateTime(c.createdAt) },
            ]} />
          </Card>
          <Card title="Nội dung yêu cầu">
            <Fields cols={3} items={[
              { label: 'Sản phẩm', value: `${c.sku} · ${c.productName}` },
              { label: 'Loại vấn đề', value: c.issueType === 'Return' ? 'Trả hàng' : c.issueType === 'Damaged' ? 'Hàng hỏng' : 'Thiếu hàng' },
              { label: 'Tem hàng', value: c.labelCode ?? '—' },
              { label: 'Loại yêu cầu', value: requestTypeLabel(c.requestType) },
              { label: 'Phương án đề nghị', value: settlementLabel(c.settlementMethod) },
              { label: 'Phương án được duyệt', value: c.approvedSettlementMethod ? settlementLabel(c.approvedSettlementMethod) : 'Chưa duyệt' },
              { label: 'Số thùng yêu cầu / được duyệt / thực tế', value: `${c.requestedQuantity ?? c.expectedQuantity - c.actualQuantity} / ${c.approvedQuantity ?? '—'} / ${c.handledQuantity ?? '—'}` },
              { label: 'Số lượng dự kiến', value: c.expectedQuantity },
              ...(c.requestType === 'Complaint' || !c.requestType ? [{ label: 'Số lượng sử dụng được', value: c.actualQuantity }] : []),
              { label: 'Giá trị điều chỉnh dự kiến', value: `${c.adjustmentAmount.toLocaleString('vi-VN')}đ` },
              { label: 'Mô tả', value: c.note ?? '—' },
              { label: 'Bằng chứng', value: c.evidenceUrl ? <a href={c.evidenceUrl} target="_blank" rel="noreferrer">Mở bằng chứng</a> : 'Chưa có' },
            ]} />
          </Card>
          {c.reviewStatus === 'UnderReview' && <Callout tone="warn"><b>Đã yêu cầu bổ sung bằng chứng:</b> {c.evidenceRequestReason ?? '—'}</Callout>}
          {c.status === 'Approved' && !c.physicalHandlingCompleted && <Callout tone="warn">Đã duyệt phương án, đang chờ xử lý hàng thực tế. Chưa điều chỉnh công nợ hoặc tạo phiếu hoàn tiền.</Callout>}
          {c.status === 'Approved' && c.physicalHandlingCompleted && !c.financialAdjustmentApplied && <Callout tone="warn">Đã xác nhận xử lý hàng, đang chờ chốt tài chính. Nếu đơn còn phần giao chưa đối soát, hoàn tất phần giao trước rồi Admin chọn Chốt tài chính.</Callout>}
          {c.documents && c.documents.length > 0 && <Card title="Phiếu trả hàng / thu hồi">
            {c.documents.map(d => <div key={d.id} style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
              <b>{d.kind === 'ReturnOrder' ? 'Phiếu trả hàng' : 'Phiếu thu hồi'} · {d.code}</b>
              <div>{d.status === 'Pending' ? 'Chờ xử lý ngoài hệ thống' : d.status === 'Waived' ? 'Admin miễn xử lý hàng' : 'Đã xác nhận xử lý'} · Duyệt {d.approvedQuantity} thùng · Thực tế {d.actualQuantity ?? '—'}</div>
              {d.note && <div>{d.note}</div>}{d.evidenceReference && <div>Bằng chứng: {d.evidenceReference}</div>}
              {d.completedAt && <div>{formatDateTime(d.completedAt)}</div>}
            </div>)}
          </Card>}
          {c.financialAdjustmentApplied && (c.debtOffsetAmount ?? 0) + (c.refundAmount ?? 0) !== c.adjustmentAmount && <Callout tone="ok">Lịch sử cũ đã điều chỉnh nghĩa vụ thanh toán. Xem công nợ và danh sách phiếu hoàn để đối soát chi tiết. {mayRefund && <a href="/refunds">Xem hoàn tiền</a>}</Callout>}
          {c.financialAdjustmentApplied && (c.debtOffsetAmount ?? 0) + (c.refundAmount ?? 0) === c.adjustmentAmount && (
            <Callout tone="ok">
              <b>Đã chốt tài chính:</b> giảm nghĩa vụ {c.adjustmentAmount.toLocaleString('vi-VN')}đ;
              cấn trừ nợ {(c.debtOffsetAmount ?? 0).toLocaleString('vi-VN')}đ;
              phiếu hoàn {(c.refundAmount ?? 0).toLocaleString('vi-VN')}đ.
              {mayRefund && c.refundId && <> · <a href="/refunds" onClick={(e) => { e.preventDefault(); navigate('/refunds'); }}>Xem phiếu hoàn tiền đã tạo</a></>}
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
          {handling && <CompleteHandlingDialog claim={c} onClose={() => setHandling(false)} />}
        </>
      )}
    </QueryState>
  );
}
