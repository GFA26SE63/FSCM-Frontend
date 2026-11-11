import { useCurrentTime } from '@/shared/hooks';
import { ShelfLifeDialog } from '../components/ShelfLifeDialog';
import { usePromoLookups } from '@/features/promos/hooks';
import { useState } from 'react';
import { Button, Card, PageHeader, SimpleTable, Tabs } from '@/shared/ui';
import { formatInstantDate, formatNumber } from '@/shared/lib';
import { useShelfLifeCurrent, useShelfLifeHistory } from '../hooks';
import type { ShelfLifeTable, ShelfLifeTier } from '../types';

export function BatchPromoPage() {
  const current = useShelfLifeCurrent();
  const history = useShelfLifeHistory();

  const [tab, setTab] = useState<'current' | 'history'>('current');
  const [edit, setEdit] = useState(false);
  const table = current.data;
  return (
    <>
      <PageHeader title="Giảm giá theo HSD" subtitle="Bảng giảm theo khoảng % HSD còn lại, áp dụng theo SKU hoặc Category sau khi batch đã được chọn." actions={<Button variant="primary" onClick={() => setEdit(true)}>Publish phiên bản mới</Button>} />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'current', label: 'Phiên bản mới nhất', count: table?.tiers.length }, { key: 'history', label: 'Lịch sử phiên bản', count: history.data?.length }]} />
      {tab === 'current' ? <TableCard table={table} loading={current.isLoading} /> : <History tables={history.data ?? []} loading={history.isLoading} />}
      {edit && <ShelfLifeDialog initial={table?.tiers ?? []} currentFrom={table?.effectiveFrom} onClose={() => setEdit(false)} />}
    </>
  );
}

function TableCard({ table, loading }: { table?: ShelfLifeTable; loading: boolean }) {
  const now = useCurrentTime();
  return <Card title={table ? `Phiên bản ${table.version} · ${new Date(table.effectiveFrom).getTime() > now ? 'chờ hiệu lực' : 'hiệu lực'} ${formatInstantDate(table.effectiveFrom)}` : 'Bảng giảm hiện tại'}>
    {loading ? 'Đang tải…' : !table ? 'Chưa có bảng giảm HSD.' : <TierTable tiers={table.tiers} />}
  </Card>;
}

function History({ tables, loading }: { tables: ShelfLifeTable[]; loading: boolean }) {
  return <Card title="Lịch sử bảng giảm" flush>{loading ? 'Đang tải…' : tables.map((table) => <Card key={table.id} title={`Phiên bản ${table.version} · ${formatInstantDate(table.effectiveFrom)}`}><TierTable tiers={table.tiers} /></Card>)}</Card>;
}

function TierTable({ tiers }: { tiers: ShelfLifeTier[] }) {
  const { products, categories } = usePromoLookups();
  return <SimpleTable rows={tiers} columns={[
    { header: 'Phạm vi', cell: (x) => x.scope === 'Sku' ? (products.data?.find((p) => p.id === x.productId) ? `${products.data.find((p) => p.id === x.productId)!.sku} · ${products.data.find((p) => p.id === x.productId)!.name}` : 'Sản phẩm đang tải…') : (categories.data?.find((c) => c.id === x.productCategoryId)?.name ?? 'Nhóm hàng đang tải…') },
    { header: 'HSD còn lại', cell: (x) => `${x.minRemainingPercent}% – < ${x.maxRemainingPercent}%` },
    { header: 'Kiểu giảm', cell: (x) => x.discountType === 'Percent' ? 'Phần trăm' : 'Tiền / đơn vị' },
    { header: 'Mức giảm', align: 'right', cell: (x) => x.discountType === 'Percent' ? `${formatNumber(x.discountValue)}%` : formatNumber(x.discountValue) },
  ]} />;
}
