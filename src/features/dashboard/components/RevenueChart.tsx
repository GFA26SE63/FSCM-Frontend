import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/shared/lib';
import type { DashboardDay, DashboardSalesRevenue } from '../types';

const AFTER = '#14655B';
const BEFORE = '#9DB8B1';
const axisMoney = (value: number) => `${Math.round(value / 1_000_000)} tr`;
const tooltipMoney = (value: unknown) => formatMoney(Number(value ?? 0));

export function RevenueByDayChart({ days }: { days: DashboardDay[] }) {
  const data = days.map((day) => ({ ...day, label: `${day.date.slice(8, 10)}/${day.date.slice(5, 7)}` }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid stroke="#EEF1EF" />
        <XAxis dataKey="label" />
        <YAxis tickFormatter={axisMoney} />
        <Tooltip formatter={tooltipMoney} />
        <Legend />
        <Line type="monotone" dataKey="afterPromo" name="Sau khuyến mãi" stroke={AFTER} strokeWidth={2} />
        <Line type="monotone" dataKey="beforePromo" name="Trước khuyến mãi" stroke={BEFORE} strokeDasharray="4 4" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RevenueBySalesChart({ rows }: { rows: DashboardSalesRevenue[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={rows}>
        <CartesianGrid stroke="#EEF1EF" />
        <XAxis dataKey="name" />
        <YAxis tickFormatter={axisMoney} />
        <Tooltip formatter={tooltipMoney} />
        <Legend />
        <Bar dataKey="afterPromo" name="Sau khuyến mãi" fill={AFTER} />
        <Bar dataKey="beforePromo" name="Trước khuyến mãi" fill={BEFORE} />
      </BarChart>
    </ResponsiveContainer>
  );
}
