import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DataTable, PageHeader, SimpleTable, StatusChip, Tabs, type Column } from '@/shared/ui';
import { formatDate, formatPercent, statusLabels } from '@/shared/lib';
import { useBatchDiscounts, useDiscountSuggestions, useStopBatchDiscount } from '../hooks';
import { DiscountDialog } from '../components/DiscountDialog';
import type { BatchDiscount, DiscountSuggestion } from '../types';

/** "Giảm giá theo HSD" – active discounts + suggestions by % shelf-life remaining (tiers from system settings). */
export function BatchPromoPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'list' | 'suggest'>('list');
  const discounts = useBatchDiscounts();
  const suggestions = useDiscountSuggestions();
  const stop = useStopBatchDiscount();
  const [target, setTarget] = useState<DiscountSuggestion[] | null>(null);

  const columns: Column<BatchDiscount>[] = [
    { key: 'code', header: 'Mã', width: '120px', render: (d) => <span className="bold">{d.code}</span> },
    { key: 'batch', header: 'Batch', text: (d) => d.batchCode },
    { key: 'product', header: 'Sản phẩm', text: (d) => d.productName },
    { key: 'wh', header: 'Kho', width: '130px', text: (d) => d.warehouseName },
    { key: 'pct', header: '% giảm', width: '80px', align: 'right', text: (d) => formatPercent(d.discountPct) },
    { key: 'period', header: 'Hiệu lực', width: '170px', text: (d) => `${formatDate(d.validFrom)} – ${formatDate(d.validTo)}` },
    { key: 'remain', header: 'HSD còn lại', width: '110px', align: 'right', text: (d) => `${d.remainingDays} ngày` },
    { key: 'status', header: 'Trạng thái', width: '120px', render: (d) => <StatusChip domain="batchDiscount" value={d.status} /> },
  ];
  return (
    <>
      <PageHeader
        title="Giảm giá theo HSD"
        subtitle="Giảm giá cho batch còn ít hạn sử dụng; bậc % theo HSD còn lại cấu hình ở Cấu hình hệ thống."
        actions={<Button variant="primary" onClick={() => navigate('/batchpromo/scan')}>Quét tem batch</Button>}
      />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'list', label: 'Đang áp dụng / lịch sử', count: discounts.data?.length }, { key: 'suggest', label: 'Gợi ý theo HSD', count: suggestions.data?.length }]} />
      {tab === 'list' ? (
        <DataTable
          title="Giảm giá theo HSD"
          rows={discounts.data}
          loading={discounts.isLoading}
          error={discounts.error}
          rowKey={(d) => d.code}
          columns={columns}
          searchPlaceholder="Mã, batch, sản phẩm…"
          filters={[{ label: 'Trạng thái', options: Object.values(statusLabels.batchDiscount), value: (d) => statusLabels.batchDiscount[d.status] }]}
          rowActionsWidth="110px"
          rowActions={(d) => d.status === 'Active' && <Button size="sm" variant="danger" onClick={() => stop.mutate(d.code)}>Dừng</Button>}
        />
      ) : (
        <Card flush>
          <SimpleTable<DiscountSuggestion>
            rows={suggestions.data ?? []}
            columns={[
              { header: 'Batch', cell: (s) => <b>{s.batchCode}</b> },
              { header: 'Sản phẩm', cell: (s) => s.productName },
              { header: 'Kho', cell: (s) => s.warehouseName },
              { header: 'HSD', cell: (s) => formatDate(s.expiry) },
              { header: 'Còn lại', align: 'right', cell: (s) => `${s.remainingPct}% (${s.remainingDays} ngày)` },
              { header: 'Khả dụng', align: 'right', cell: (s) => s.available },
              { header: 'Gợi ý', align: 'right', cell: (s) => (s.suggestedPct ? `${s.suggestedPct}%` : '—') },
              { header: '', width: '120px', align: 'right', cell: (s) => (s.activeDiscountPct ? <StatusChip value="Đang áp dụng" /> : <Button size="sm" variant="primary" onClick={() => setTarget([s])}>Tạo giảm giá</Button>) },
            ]}
          />
        </Card>
      )}
      <DiscountDialog items={target} onClose={() => setTarget(null)} />
    </>
  );
}
