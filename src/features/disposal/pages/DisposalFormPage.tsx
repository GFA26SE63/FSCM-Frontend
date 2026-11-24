import { useMemo, useState } from 'react';
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
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [overdueFilter, setOverdueFilter] = useState('');

  const toggle = (c: string, on: boolean) => {
    if (create.isPending) return;
    setPicked((p) => (on ? [...p, c] : p.filter((x) => x !== c)));
    setOperationId(crypto.randomUUID());
  };

  return (
    <>
      <PageHeader back="/disposal" title="Lập phiếu hủy hàng hết hạn" subtitle="Chọn lô hàng quá HSD còn tồn, không còn giữ chỗ hoặc đang soạn. Mỗi kho tạo một phiếu." />
      <QueryState query={query}>
        {(rows) => {
          const warehouseOptions = Array.from(
            new Map(rows.filter((r) => r.warehouseCode || r.warehouseName).map((r) => [r.warehouseCode || r.warehouseName, r.warehouseName || r.warehouseCode])).entries(),
          ).map(([code, name]) => ({ value: code, label: `${code} · ${name}` }));

          const q = search.trim().toLowerCase();
          const filtered = rows.filter((c) => {
            if (warehouseFilter && c.warehouseCode !== warehouseFilter && c.warehouseName !== warehouseFilter) {
              return false;
            }
            if (overdueFilter) {
              const minDays = Number(overdueFilter);
              if (Number.isFinite(minDays) && (c.daysOverdue ?? 0) < minDays) return false;
            }
            if (!q) return true;
            return (
              (c.batchCode ?? '').toLowerCase().includes(q) ||
              (c.productName ?? '').toLowerCase().includes(q) ||
              (c.sku ?? '').toLowerCase().includes(q) ||
              (c.warehouseName ?? '').toLowerCase().includes(q) ||
              (c.warehouseCode ?? '').toLowerCase().includes(q)
            );
          });

          const allFilteredSelected = filtered.length > 0 && filtered.every((c) => picked.includes(c.batchCode));
          const toggleAll = (on: boolean) => {
            if (create.isPending) return;
            const filteredCodes = filtered.map((c) => c.batchCode);
            if (on) {
              setPicked((p) => Array.from(new Set([...p, ...filteredCodes])));
            } else {
              setPicked((p) => p.filter((code) => !filteredCodes.includes(code)));
            }
            setOperationId(crypto.randomUUID());
          };

          return (
            <>
              {rows.length === 0 && <Callout>Không có lô hàng đủ điều kiện xử lý. Lô hàng còn giữ chỗ, đang soạn hoặc có khóa cần giải quyết sẽ chưa được đưa vào danh sách.</Callout>}
              <Card>
                <div className="form-grid cols-2">
                  <FormField label="Hình thức xử lý">
                    <Select
                      value={method}
                      onChange={(e) => {
                        if (create.isPending) return;
                        setMethod(e.target.value as Disposal['method']);
                        setOperationId(crypto.randomUUID());
                      }}
                      options={['Tiêu hủy tại kho', 'Trả nhà cung cấp']}
                    />
                  </FormField>
                </div>
              </Card>

              <Card title="Chọn lô hàng cần hủy">
                <div className="row-wrap" style={{ gap: 12, marginBottom: 16 }}>
                  <label className="lbl" style={{ flex: '1 1 240px' }}>
                    Tìm kiếm lô hàng
                    <input
                      className="inp"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Mã lô, tên sản phẩm, SKU..."
                    />
                  </label>
                  <label className="lbl" style={{ minWidth: 200 }}>
                    Lọc theo kho
                    <select
                      className="inp"
                      value={warehouseFilter}
                      onChange={(e) => setWarehouseFilter(e.target.value)}
                    >
                      <option value="">Tất cả kho</option>
                      {warehouseOptions.map((w) => (
                        <option key={w.value} value={w.value}>{w.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="lbl" style={{ minWidth: 180 }}>
                    Thời gian quá hạn
                    <select
                      className="inp"
                      value={overdueFilter}
                      onChange={(e) => setOverdueFilter(e.target.value)}
                    >
                      <option value="">Tất cả</option>
                      <option value="30">Quá hạn &gt; 30 ngày</option>
                      <option value="60">Quá hạn &gt; 60 ngày</option>
                      <option value="90">Quá hạn &gt; 90 ngày</option>
                    </select>
                  </label>
                </div>

                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="muted">
                    Tìm thấy <b>{filtered.length}</b> / {rows.length} lô hàng đủ điều kiện · Đã chọn <b>{picked.length}</b> lô hàng
                  </span>
                  {filtered.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => toggleAll(!allFilteredSelected)}
                    >
                      {allFilteredSelected ? 'Bỏ chọn tất cả hiển thị' : 'Chọn tất cả hiển thị'}
                    </Button>
                  )}
                </div>

                <SimpleTable<DisposalCandidate>
                  rows={filtered}
                  paginate
                  columns={[
                    {
                      header: (
                        <Checkbox
                          label=""
                          checked={allFilteredSelected}
                          onChange={toggleAll}
                        />
                      ),
                      width: '44px',
                      cell: (c) => (
                        <Checkbox
                          label=""
                          checked={picked.includes(c.batchCode)}
                          onChange={(v) => toggle(c.batchCode, v)}
                        />
                      ),
                    },
                    { header: 'Lô hàng', cell: (c) => <b>{c.batchCode}</b> },
                    { header: 'Kho', cell: (c) => `${c.warehouseCode || '—'} · ${c.warehouseName || '—'}` },
                    { header: 'Sản phẩm', cell: (c) => <>{c.sku} · {c.productName}</> },
                    { header: 'HSD', cell: (c) => formatDate(c.expiry) },
                    { header: 'Quá hạn', align: 'right', cell: (c) => `${c.daysOverdue ?? 0} ngày` },
                    { header: 'Số lượng', align: 'right', cell: (c) => formatCases(c.qty ?? 0) },
                    { header: 'Giá trị', align: 'right', cell: (c) => (c.value != null ? formatMoney(c.value) : '—') },
                  ]}
                  empty="Không tìm thấy lô hàng nào phù hợp với bộ lọc."
                />
              </Card>

              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <Button onClick={() => navigate('/disposal')}>Hủy</Button>
                <Button
                  variant="primary"
                  disabled={picked.length === 0}
                  loading={create.isPending}
                  onClick={async () => {
                    const r = await create.mutateAsync({ batchCodes: picked, method, operationId });
                    if (r.items[0]) navigate(`/disposal/${r.items[0].code}`);
                  }}
                >
                  Lập phiếu hủy ({picked.length} lô hàng)
                </Button>
              </div>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
