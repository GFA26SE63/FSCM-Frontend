import { useState } from 'react';
import { Button, Card, FormDialog, PageHeader, SimpleTable, Tabs } from '@/shared/ui';
import { formatDate, formatNumber } from '@/shared/lib';
import { usePublishShelfLife, useShelfLifeCurrent, useShelfLifeHistory } from '../hooks';
import type { ShelfLifeTable, ShelfLifeTier } from '../types';

const defaultTiers = JSON.stringify([
  { scope: 'Category', productCategoryId: '', minRemainingPercent: 0, maxRemainingPercent: 20, discountType: 'Percent', discountValue: 20 },
  { scope: 'Category', productCategoryId: '', minRemainingPercent: 20, maxRemainingPercent: 40, discountType: 'Percent', discountValue: 10 },
], null, 2);

export function BatchPromoPage() {
  const current = useShelfLifeCurrent();
  const history = useShelfLifeHistory();
  const publish = usePublishShelfLife();
  const [tab, setTab] = useState<'current' | 'history'>('current');
  const [edit, setEdit] = useState(false);
  const table = current.data;
  return (
    <>
      <PageHeader title="Giảm giá theo HSD" subtitle="Bảng giảm theo khoảng % HSD còn lại, áp dụng theo SKU hoặc Category sau khi batch đã được chọn." actions={<Button variant="primary" onClick={() => setEdit(true)}>Publish phiên bản mới</Button>} />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'current', label: 'Đang áp dụng', count: table?.tiers.length }, { key: 'history', label: 'Lịch sử phiên bản', count: history.data?.length }]} />
      {tab === 'current' ? <TableCard table={table} loading={current.isLoading} /> : <History tables={history.data ?? []} loading={history.isLoading} />}
      {edit && <FormDialog
        open width={760} title="Publish bảng giảm theo HSD" submitLabel="Publish"
        initial={{ effectiveFrom: new Date().toISOString().slice(0, 10), note: '', tiersJson: defaultTiers }}
        fields={[
          { key: 'effectiveFrom', label: 'Hiệu lực từ', type: 'date', required: true },
          { key: 'note', label: 'Ghi chú', type: 'textarea', span: 2 },
          { key: 'tiersJson', label: 'Các bậc giảm (JSON)', type: 'textarea', required: true, span: 2, hint: 'Mỗi bậc gồm scope, productId hoặc productCategoryId, minRemainingPercent, maxRemainingPercent, discountType (Percent/FixedPerUnit), discountValue.' },
        ]}
        onClose={() => setEdit(false)}
        onSubmit={async (v) => {
          let tiers: ShelfLifeTier[];
          try { tiers = JSON.parse(String(v.tiersJson)) as ShelfLifeTier[]; } catch { throw new Error('Các bậc giảm phải là JSON hợp lệ.'); }
          if (!Array.isArray(tiers) || !tiers.length) throw new Error('Phải có ít nhất một bậc giảm.');
          await publish.mutateAsync({ effectiveFrom: new Date(`${v.effectiveFrom}T00:00:00Z`).toISOString(), note: v.note || undefined, tiers });
          setEdit(false);
        }}
      />}
    </>
  );
}

function TableCard({ table, loading }: { table?: ShelfLifeTable; loading: boolean }) {
  return <Card title={table ? `Phiên bản ${table.version} · hiệu lực ${formatDate(table.effectiveFrom)}` : 'Bảng giảm hiện tại'}>
    {loading ? 'Đang tải…' : !table ? 'Chưa có bảng giảm HSD.' : <TierTable tiers={table.tiers} />}
  </Card>;
}

function History({ tables, loading }: { tables: ShelfLifeTable[]; loading: boolean }) {
  return <Card title="Lịch sử bảng giảm" flush>{loading ? 'Đang tải…' : tables.map((table) => <Card key={table.id} title={`Phiên bản ${table.version} · ${formatDate(table.effectiveFrom)}`}><TierTable tiers={table.tiers} /></Card>)}</Card>;
}

function TierTable({ tiers }: { tiers: ShelfLifeTier[] }) {
  return <SimpleTable rows={tiers} columns={[
    { header: 'Phạm vi', cell: (x) => x.scope === 'Sku' ? `SKU ${x.productId ?? '—'}` : `Category ${x.productCategoryId ?? '—'}` },
    { header: 'HSD còn lại', cell: (x) => `${x.minRemainingPercent}% – < ${x.maxRemainingPercent}%` },
    { header: 'Kiểu giảm', cell: (x) => x.discountType === 'Percent' ? 'Phần trăm' : 'Tiền / đơn vị' },
    { header: 'Mức giảm', align: 'right', cell: (x) => x.discountType === 'Percent' ? `${formatNumber(x.discountValue)}%` : formatNumber(x.discountValue) },
  ]} />;
}
