import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, Checkbox, FormField, PageHeader, QueryState, Select, SimpleTable } from '@/shared/ui';
import { formatCases, formatDate, formatMoney } from '@/shared/lib';
import { useCreateDisposal, useDisposalCandidates } from '../hooks';
import type { Disposal, DisposalCandidate } from '../types';

/** Pick expired batches (only expired batches can be disposed); one document is created per warehouse. */
export function DisposalFormPage() {
  const navigate = useNavigate();
  const query = useDisposalCandidates();
  const create = useCreateDisposal();
  const [picked, setPicked] = useState<string[]>([]);
  const [method, setMethod] = useState<Disposal['method']>('Tiêu hủy tại kho');
  const toggle = (c: string, on: boolean) => setPicked((p) => (on ? [...p, c] : p.filter((x) => x !== c)));
  return (
    <>
      <PageHeader back="/disposal" title="Lập phiếu hủy hàng hết hạn" subtitle="Chọn các batch đã hết hạn cần hủy." />
      <QueryState query={query}>
        {(rows) => (
          <>
            {rows.length === 0 && <Callout tone="ok">Không có batch hết hạn nào còn tồn kho.</Callout>}
            <Card flush>
              <SimpleTable<DisposalCandidate>
                rows={rows}
                columns={[
                  { header: '', width: '44px', cell: (c) => <Checkbox label="" checked={picked.includes(c.batchCode)} onChange={(v) => toggle(c.batchCode, v)} /> },
                  { header: 'Batch', cell: (c) => <b>{c.batchCode}</b> },
                  { header: 'Kho', cell: (c) => c.warehouseName },
                  { header: 'Sản phẩm', cell: (c) => c.productName },
                  { header: 'HSD', cell: (c) => formatDate(c.expiry) },
                  { header: 'Quá hạn', align: 'right', cell: (c) => `${c.daysOverdue} ngày` },
                  { header: 'Số lượng', align: 'right', cell: (c) => formatCases(c.qty) },
                  { header: 'Giá trị', align: 'right', cell: (c) => formatMoney(c.value) },
                ]}
              />
            </Card>
            <Card>
              <div className="form-grid cols-2">
                <FormField label="Hình thức xử lý"><Select value={method} onChange={(e) => setMethod(e.target.value as Disposal['method'])} options={['Tiêu hủy tại kho', 'Trả nhà cung cấp']} /></FormField>
              </div>
            </Card>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button onClick={() => navigate('/disposal')}>Hủy</Button>
              <Button
                variant="primary"
                disabled={picked.length === 0}
                loading={create.isPending}
                onClick={async () => {
                  const r = await create.mutateAsync({ batchCodes: picked, method });
                  navigate(`/disposal/${r.items[0].code}`);
                }}
              >
                Lập phiếu hủy ({picked.length} batch)
              </Button>
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}
