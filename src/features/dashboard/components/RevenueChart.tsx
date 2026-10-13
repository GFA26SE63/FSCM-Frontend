import { CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip, BarElement, type ChartOptions } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { formatMoney } from '@/shared/lib';
import type { DashboardDay, DashboardSalesRevenue } from '../types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

const AFTER = '#14655B';   // brand teal – revenue after promotion (the KPI basis)
const BEFORE = '#9DB8B1';  // muted – before promotion, for reference only

const money: ChartOptions<'line' | 'bar'>['scales'] = {
  y: { ticks: { callback: (v) => `${Math.round(Number(v) / 1_000_000)} tr` }, grid: { color: '#EEF1EF' } },
  x: { grid: { display: false } },
};
const tooltip = { callbacks: { label: (c: { dataset: { label?: string }; parsed: { y: number } }) => `${c.dataset.label}: ${formatMoney(c.parsed.y)}` } };

/** Daily revenue of the period: after vs before promotion. */
export function RevenueByDayChart({ days }: { days: DashboardDay[] }) {
  return (
    <Line
      height={110}
      data={{
        labels: days.map((d) => d.date.slice(8, 10) + '/' + d.date.slice(5, 7)),
        datasets: [
          { label: 'Sau khuyến mãi', data: days.map((d) => d.afterPromo), borderColor: AFTER, backgroundColor: AFTER, tension: 0.3, pointRadius: 2, borderWidth: 2 },
          { label: 'Trước khuyến mãi', data: days.map((d) => d.beforePromo), borderColor: BEFORE, backgroundColor: BEFORE, tension: 0.3, pointRadius: 0, borderWidth: 1.5, borderDash: [4, 4] },
        ],
      }}
      options={{ responsive: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip }, scales: money as ChartOptions<'line'>['scales'] }}
    />
  );
}

/** Top Sales by revenue after promotion (only orders closed by that Sales). */
export function RevenueBySalesChart({ rows }: { rows: DashboardSalesRevenue[] }) {
  return (
    <Bar
      height={150}
      data={{
        labels: rows.map((r) => r.name),
        datasets: [
          { label: 'Sau khuyến mãi', data: rows.map((r) => r.afterPromo), backgroundColor: AFTER, borderRadius: 4 },
          { label: 'Trước khuyến mãi', data: rows.map((r) => r.beforePromo), backgroundColor: BEFORE, borderRadius: 4 },
        ],
      }}
      options={{ responsive: true, plugins: { legend: { position: 'bottom' }, tooltip }, scales: money as ChartOptions<'bar'>['scales'] }}
    />
  );
}
