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
              { label: 'Đơn hàng', value: <a href={`/orders/${c.orderCode}`} onClick={(e) => { e.preventDefault(); navigate(`/orders/${c.orderCode}`); }}>{c.orderCode}</a> },
              { label: 'Retailer', value: `${c.retailerName} (${c.retailerCode})` },
              { label: 'Thời gian gửi', value: formatDateTime(c.createdAt) },
            ]} />
          </Card>
          <Card title="Chi tiết khiếu nại">
            <Fields cols={3} items={[
              { label: 'SKU', value: c.sku ?? '—' },
              { label: 'Batch / tem', value: c.labelCode ?? '—' },
              { label: 'Loại lỗi', value: c.issueType ?? '—' },
              { label: 'Dự kiến / thực nhận', value: c.expectedQuantity != null && c.actualQuantity != null ? `${c.expectedQuantity} / ${c.actualQuantity}` : '—' },
              { label: 'Giá cuối / đơn vị', value: c.finalUnitPrice != null ? `${c.finalUnitPrice.toLocaleString('vi-VN')} đ` : '—' },
              { label: 'Điều chỉnh tài chính', value: c.adjustmentAmount != null ? `${c.adjustmentAmount.toLocaleString('vi-VN')} đ` : '—' },
            ]} />
            <p>{c.content ?? c.note ?? '—'}</p>
            {c.evidenceUrl && <a href={c.evidenceUrl} target="_blank" rel="noreferrer">Mở bằng chứng</a>}
          </Card>
          {c.status !== 'Open' && <Callout tone={c.status === 'Rejected' ? 'danger' : 'ok'}><b>{c.status === 'Rejected' ? 'Đã từ chối:' : 'Đã duyệt:'}</b> {c.result}</Callout>}
          <ResolveDialog code={resolving ? c.code : null} onClose={() => setResolving(false)} />
        </>
      )}
    </QueryState>
  );
}
