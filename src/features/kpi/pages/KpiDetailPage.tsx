import { useParams } from 'react-router-dom';
import { Card, Fields, PageHeader, StatusChip } from '@/shared/ui';
import { formatMoney } from '@/shared/lib';
import { useKpiSales } from '../hooks';
import { QueryState } from '@/shared/ui';

export function KpiDetailPage() {
  const { name = '' } = useParams();
  const query = useKpiSales();
  return (
    <QueryState query={query}>
      {({ items, period }) => {
        const r = items.find((x) => x.name === name);
        if (!r) return <PageHeader back="/kpi" title="Không tìm thấy Sales" />;
        return (
          <>
            <PageHeader back="/kpi" title={r.name} subtitle={`Nhóm ${r.group} · kỳ ${period}`} chips={<StatusChip domain="kpi" value={r.result} />} />
            <Card title="Chỉ tiêu và kết quả">
              <div className="stack-sm">
                <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, r.achievedPct)}%` }} /></div>
                <span className="muted small">{r.achievedPct}% mục tiêu · hạng {r.rank}{r.rank > 1 ? ` · cách hạng trên ${formatMoney(r.gapToNext)}` : ''}</span>
              </div>
            </Card>
            <Card>
              <Fields cols={3} items={[
                { label: 'Doanh thu sau KM', value: formatMoney(r.after) }, { label: 'Doanh thu trước KM', value: formatMoney(r.before) }, { label: '% khuyến mãi', value: `${r.promoPct}%` },
                { label: 'Mục tiêu', value: formatMoney(r.target) }, { label: 'Số đơn', value: r.orders }, { label: 'Điểm bán / mới', value: `${r.stores} / ${r.newStores}` },
              ]} />
            </Card>
          </>
        );
      }}
    </QueryState>
  );
}
