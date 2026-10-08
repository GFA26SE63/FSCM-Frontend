import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BadgeDollarSign, CircleX, Clock3, ShoppingBasket } from 'lucide-react'
import { Card } from '../../../shared/ui'
import { MetricCard, PageHeader } from '../../../shared/components/portalComponents'
import { compactNumber } from '../../../shared/lib/format'
import { usePortalStore } from '../state/portalStore'

const salesData = [
  { name: 'Trần Thị Bình', revenue: 245.7 },
  { name: 'Lê Minh Hoàng', revenue: 235.2 },
  { name: 'Nguyễn Văn An', revenue: 257.2 },
  { name: 'Phạm Thu Hà', revenue: 171.4 },
  { name: 'Võ Quốc Huy', revenue: 150.3 },
]

const topProducts = [
  { sku: 'SKU001', name: 'Sữa chua có đường', quantity: 1240, revenue: 297_800_000 },
  { sku: 'SKU003', name: 'Sữa tươi tiệt trùng', quantity: 980, revenue: 301_900_000 },
  { sku: 'SKU002', name: 'Sữa chua uống', quantity: 760, revenue: 155_300_000 },
  { sku: 'SKU005', name: 'Bánh mì sandwich', quantity: 640, revenue: 179_200_000 },
]

export function DashboardScreen() {
  const orders = usePortalStore((state) => state.orders)
  const pending = orders.filter((order) => order.status === 'Chờ duyệt').length
  const rejected = orders.filter((order) => order.status === 'Bị từ chối').length
  const statusData = Object.entries(
    orders.reduce<Record<string, number>>((result, order) => {
      result[order.status] = (result[order.status] ?? 0) + 1
      return result
    }, {}),
  ).map(([name, value]) => ({ name, value }))

  return (
    <div className="page-stack">
      <PageHeader
        title="Tổng quan vận hành"
        description="Tình hình đơn hàng, doanh thu sau khuyến mãi và hiệu suất mạng lưới tháng 9/2026."
      />
      <div className="metric-grid">
        <MetricCard label="Tổng đơn tháng 9" value="96" note="Dữ liệu toàn hệ thống" icon={<ShoppingBasket size={18} />} />
        <MetricCard label="Doanh thu sau KM" value="941,2 triệu" note="Trước KM 957,65 triệu" tone="primary" icon={<BadgeDollarSign size={18} />} />
        <MetricCard label="Đơn chờ duyệt" value={`${pending}`} note="Cần xử lý hôm nay" tone="info" icon={<Clock3 size={18} />} />
        <MetricCard label="Đơn bị từ chối" value={`${rejected}`} note="Không đủ hàng / từ chối" tone="danger" icon={<CircleX size={18} />} />
      </div>
      <div className="dashboard-grid">
        <Card className="chart-card chart-card--wide">
          <div className="card-heading">
            <div><span className="section-kicker">Hiệu suất bán hàng</span><h2>Doanh thu sau khuyến mãi</h2></div>
            <span className="chart-unit">triệu đồng</span>
          </div>
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData} margin={{ left: -10, right: 8, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ebe7" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f2f7f5' }} />
                <Bar dataKey="revenue" fill="#14655b" radius={[7, 7, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="chart-card">
          <div className="card-heading">
            <div><span className="section-kicker">Luồng đơn</span><h2>Theo trạng thái</h2></div>
          </div>
          <div className="status-bars">
            {statusData.map((item) => (
              <div key={item.name}>
                <div><span>{item.name}</span><strong>{item.value}</strong></div>
                <span className="status-bars__track"><i style={{ width: `${Math.max(12, (item.value / orders.length) * 100)}%` }} /></span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="chart-card chart-card--full">
          <div className="card-heading">
            <div><span className="section-kicker">Sản phẩm</span><h2>SKU bán chạy</h2></div>
          </div>
          <div className="top-products">
            {topProducts.map((product, index) => (
              <article key={product.sku}>
                <span className="top-products__rank">{index + 1}</span>
                <div><strong>{product.sku} · {product.name}</strong><span>{product.quantity.toLocaleString('vi-VN')} thùng</span></div>
                <span className="top-products__bar"><i style={{ width: `${(product.quantity / topProducts[0].quantity) * 100}%` }} /></span>
                <strong>{compactNumber(product.revenue)}đ</strong>
              </article>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
