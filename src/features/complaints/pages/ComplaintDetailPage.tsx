import { useState } from 'react';
import { useNavigate, useParams } from '@/shared/router/compat';
import { Button, Callout, Card, Fields, PageHeader, QueryState, StatusChip } from '@/shared/ui';
import { formatDateTime } from '@/shared/lib';
import { useComplaint } from '../hooks';
import { ResolveDialog } from '../components/ResolveDialog';

export function ComplaintDetailPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const query = useComplaint(code);
  const [resolving, setResolving] = useState(false);
  return (
    <QueryState query={query}>
      {(c) => (
        <>
          <PageHeader back="/complaints" title={`Khiếu nại ${c.code}`} subtitle={c.retailerName} chips={<StatusChip domain="complaint" value={c.status} />} actions={c.status === 'Open' ? <Button variant="primary" onClick={() => setResolving(true)}>Xử lý</Button> : undefined} />
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
          {c.status !== 'Open' && <Callout tone={c.status === 'Rejected' ? 'danger' : 'ok'}><b>Kết quả xử lý:</b> {c.response ?? '—'}</Callout>}
          <ResolveDialog code={resolving ? c.code : null} onClose={() => setResolving(false)} />
        </>
      )}
    </QueryState>
  );
}
