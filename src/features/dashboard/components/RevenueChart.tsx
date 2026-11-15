import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/shared/lib';
import type { DashboardDay } from '../types';

export function RevenueByDayChart({ days }: { days: DashboardDay[] }) {
  return <ResponsiveContainer width="100%" height={280}>
    <LineChart data={days.map(d => ({ ...d, label: `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}` }))}>
      <CartesianGrid stroke="#e3e9e7" strokeDasharray="3 3" />
      <XAxis dataKey="label" minTickGap={28} />
      <YAxis width={70} tickFormatter={v => `${Number(v) / 1_000_000} tr`} />
      <Tooltip formatter={v => formatMoney(Number(v ?? 0))} />
      <Legend />
      <Line type="monotone" dataKey="recognizedRevenue" name="Doanh thu ghi nhận" stroke="#14655b" strokeWidth={2} dot={false} />
      <Line type="monotone" dataKey="collectedAmount" name="Tiền đã thu" stroke="#ad6a16" strokeWidth={2} dot={false} />
    </LineChart>
  </ResponsiveContainer>;
}
