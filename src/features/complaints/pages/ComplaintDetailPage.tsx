import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
          <Card title="Nội dung khiếu nại">{c.content}</Card>
          {c.status === 'Resolved' && <Callout tone="ok"><b>Kết quả xử lý:</b> {c.result}</Callout>}
          <ResolveDialog code={resolving ? c.code : null} onClose={() => setResolving(false)} />
        </>
      )}
    </QueryState>
  );
}
