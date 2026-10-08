import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Ban,
  Check,
  CircleHelp,
  MapPin,
  Network,
  PackageCheck,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  OrderStatus,
  PortalOrder,
  ResourceRow,
} from '../../../shared/domain/portal'
import { formatVnd } from '../../../shared/lib/format'
import { statusTone } from '../../../shared/lib/status'
import {
  DataTable,
  DetailGrid,
  FilterToolbar,
  PageHeader,
  Timeline,
} from '../../../shared/components/portalComponents'
import { Button, Card, Modal, StatusBadge } from '../../../shared/ui'
import { products, retailers } from '../data/demoData'
import { usePortalStore } from '../state/portalStore'

const orderColumns = [
  { key: 'code', label: 'Mã đơn' },
  { key: 'retailer', label: 'Retailer' },
  { key: 'products', label: 'Sản phẩm' },
  { key: 'sales', label: 'Sales' },
  { key: 'created', label: 'Thời gian' },
  { key: 'channel', label: 'Kênh' },
  { key: 'total', label: 'Thành tiền', align: 'right' as const },
  { key: 'status', label: 'Trạng thái' },
]

function orderTotals(order: PortalOrder) {
  const subtotal = order.lines.reduce(
    (sum, line) => sum + products[line.sku].price * line.quantity,
    0,
  )
  const discount = order.lines.reduce(
    (sum, line) =>
      sum +
      Math.round(
        (products[line.sku].price * line.quantity * line.discountPercent) / 100,
      ),
    0,
  )
  return { subtotal, discount, final: subtotal - discount }
}

function productSummary(order: PortalOrder) {
  return order.lines.map((line) => `${line.sku} × ${line.quantity}`).join(', ')
}

export function OrdersScreen() {
  const orders = usePortalStore((state) => state.orders)
  const [selectedOrderId, setSelectedOrderId] = useState<string>()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Tất cả')
  const [channel, setChannel] = useState('Tất cả')

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi')
    return orders.filter((order) => {
      const retailer = retailers[order.retailerId]
      const matchesQuery =
        !normalized ||
        [
          order.id,
          retailer.name,
          order.createdBy,
          productSummary(order),
        ].some((value) => value.toLocaleLowerCase('vi').includes(normalized))
      return (
        matchesQuery &&
        (status === 'Tất cả' || order.status === status) &&
        (channel === 'Tất cả' || order.channel === channel)
      )
    })
  }, [channel, orders, query, status])

  const rows: ResourceRow[] = filteredOrders.map((order) => ({
    id: order.id,
    code: order.id,
    retailer: retailers[order.retailerId].name,
    products: productSummary(order),
    sales: order.createdBy,
    created: order.createdAt,
    channel: order.channel,
    total: formatVnd(orderTotals(order).final),
    status: order.status,
  }))

  if (selectedOrderId) {
    return (
      <OrderDetail
        orderId={selectedOrderId}
        onBack={() => setSelectedOrderId(undefined)}
      />
    )
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Danh sách đơn hàng"
        description="Duyệt đơn, kiểm tra khuyến mãi và xem kết quả phân bổ kho–batch trước khi xuất."
      />
      <FilterToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Mã đơn, retailer, sản phẩm hoặc Sales…"
        resultCount={rows.length}
      >
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Trạng thái">
          <option>Tất cả</option>
          <option>Chờ duyệt</option>
          <option>Đã duyệt</option>
          <option>Đã xuất kho</option>
          <option>Đang giao</option>
          <option>Đã giao</option>
          <option>Bị từ chối</option>
          <option>Đã hủy</option>
        </select>
        <select value={channel} onChange={(event) => setChannel(event.target.value)} aria-label="Kênh tạo">
          <option>Tất cả</option>
          <option>Online</option>
          <option>Offline</option>
        </select>
      </FilterToolbar>
      <DataTable columns={orderColumns} rows={rows} onRowClick={(row) => setSelectedOrderId(row.id)} />
    </div>
  )
}

function OrderDetail({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const order = usePortalStore((state) =>
    state.orders.find((item) => item.id === orderId),
  )
  const approveOrder = usePortalStore((state) => state.approveOrder)
  const closeOrder = usePortalStore((state) => state.closeOrder)
  const [traceOpen, setTraceOpen] = useState(false)
  const [decision, setDecision] = useState<'reject' | 'cancel'>()
  const [reason, setReason] = useState('')
  if (!order) return null

  const retailer = retailers[order.retailerId]
  const totals = orderTotals(order)
  const canReview = order.status === 'Chờ duyệt'
  const canCancel = order.status === 'Chờ duyệt' || order.status === 'Đã duyệt'

  const submitDecision = () => {
    if (!decision || !reason.trim()) return
    const nextStatus: Extract<OrderStatus, 'Bị từ chối' | 'Đã hủy'> =
      decision === 'cancel' ? 'Đã hủy' : 'Bị từ chối'
    closeOrder(order.id, nextStatus, reason.trim())
    toast.success(
      `${order.id} đã ${decision === 'cancel' ? 'hủy' : 'bị từ chối'}; hàng tạm giữ đã được trả lại.`,
    )
    setDecision(undefined)
    setReason('')
  }

  return (
    <div className="page-stack">
      <button className="back-link" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        Danh sách đơn hàng
      </button>
      <PageHeader
        eyebrow={`FSCM Portal / Đơn hàng / ${order.id}`}
        title={`Chi tiết ${order.id}`}
        description={`${retailer.id} · ${retailer.name} · tạo ${order.createdAt}`}
        actions={
          <div className="detail-actions">
            {canCancel && (
              <Button variant="danger" icon={<Ban size={17} />} onClick={() => setDecision('cancel')}>
                Hủy đơn
              </Button>
            )}
            {canReview && (
              <>
                <Button variant="secondary" onClick={() => setDecision('reject')}>
                  Từ chối
                </Button>
                <Button
                  icon={<Check size={17} />}
                  onClick={() => {
                    approveOrder(order.id)
                    toast.success(
                      `Đã duyệt ${order.id}; picking list theo từng kho đã được sinh.`,
                    )
                  }}
                >
                  Duyệt đơn
                </Button>
              </>
            )}
          </div>
        }
      />

      {order.rejectionReason && (
        <div className="alert alert--danger">
          <Ban size={19} />
          <div>
            <strong>{order.status}</strong>
            <span>{order.rejectionReason}</span>
          </div>
        </div>
      )}
      {order.promotionChanged && (
        <div className="alert alert--warning">
          <RotateCcw size={19} />
          <div>
            <strong>Khuyến mãi thay đổi khi đồng bộ</strong>
            <span>
              App tạm tính −{formatVnd(order.localDiscount ?? 0)}. KM03 đã bị tạm dừng nên hệ thống tính lại theo dữ liệu hiện tại.
            </span>
          </div>
        </div>
      )}

      <div className="content-grid content-grid--detail">
        <div className="content-column">
          <Card className="detail-card">
            <div className="card-heading">
              <div>
                <span className="section-kicker">Thông tin đơn</span>
                <h2>Thông tin vận hành</h2>
              </div>
              <StatusBadge tone={statusTone(order.status)}>{order.status}</StatusBadge>
            </div>
            <DetailGrid
              items={[
                { label: 'Order number', value: order.id },
                { label: 'Retailer', value: `${retailer.id} · ${retailer.name}` },
                { label: 'Địa chỉ giao', value: retailer.address },
                { label: 'Sales tạo đơn', value: order.createdBy },
                { label: 'Kênh tạo', value: order.channel },
                { label: 'Tới hệ thống lúc', value: order.syncedAt ?? order.createdAt },
                { label: 'Thanh toán', value: order.payment },
                { label: 'Trạng thái tiền', value: order.paymentStatus },
                { label: 'Người duyệt', value: order.reviewer ?? '—' },
                {
                  label: 'Xe / người giao',
                  value: order.delivery
                    ? `${order.delivery.plate} · ${order.delivery.driver} · ${order.delivery.phone}`
                    : 'Ghi nhận khi chuyển Đang giao',
                },
              ]}
            />
          </Card>

          <Card className="detail-card">
            <div className="card-heading">
              <div>
                <span className="section-kicker">Order summary</span>
                <h2>Sản phẩm và khuyến mãi</h2>
              </div>
            </div>
            <div className="line-table-wrap">
              <table className="line-table">
                <thead>
                  <tr>
                    <th>SKU / Sản phẩm</th>
                    <th>Số lượng</th>
                    <th>Đơn giá</th>
                    <th>Khuyến mãi</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => {
                    const product = products[line.sku]
                    const lineTotal =
                      product.price * line.quantity * (1 - line.discountPercent / 100)
                    return (
                      <tr key={line.sku}>
                        <td>
                          <strong>{line.sku}</strong>
                          <span>{product.name}</span>
                        </td>
                        <td>{line.quantity} thùng</td>
                        <td>{formatVnd(product.price)}</td>
                        <td>{line.discountPercent ? `−${line.discountPercent}%` : '—'}</td>
                        <td>{formatVnd(lineTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="order-totals">
              <div><span>Tạm tính</span><strong>{formatVnd(totals.subtotal)}</strong></div>
              <div><span>Khuyến mãi</span><strong className="discount">−{formatVnd(totals.discount)}</strong></div>
              <div className="order-totals__final"><span>Thành tiền</span><strong>{formatVnd(totals.final)}</strong></div>
            </div>
          </Card>

          <Card className="detail-card">
            <div className="card-heading">
              <div>
                <span className="section-kicker">Allocation result</span>
                <h2>Phân bổ kho & batch</h2>
              </div>
              <Button
                variant="secondary"
                icon={<CircleHelp size={16} />}
                onClick={() => setTraceOpen(true)}
              >
                Giải thích B1–B5
              </Button>
            </div>
            {order.allocations.length ? (
              <div className="allocation-grid">
                {order.allocations.map((allocation) => (
                  <article key={`${allocation.sku}-${allocation.batchCode}`}>
                    <div className="allocation-grid__icon"><PackageCheck size={19} /></div>
                    <div>
                      <strong>{allocation.sku} · {allocation.quantity} thùng</strong>
                      <span>{allocation.batchCode}</span>
                      <small>
                        {allocation.warehouse} · HSD {allocation.expiryDate} · {allocation.distanceKm} km
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-allocation">
                <Network size={28} />
                <strong>Không có phân bổ hợp lệ</strong>
                <span>Đơn không giữ hàng và không sinh picking list.</span>
              </div>
            )}
          </Card>
        </div>

        <aside className="content-column content-column--aside">
          <Card className="detail-card sticky-card">
            <div className="card-heading">
              <div>
                <span className="section-kicker">Audit trail</span>
                <h2>Dòng thời gian</h2>
              </div>
            </div>
            <Timeline items={order.timeline} />
          </Card>
          <Card className="detail-card delivery-card">
            <MapPin size={20} />
            <div>
              <strong>Điểm giao hàng</strong>
              <span>{retailer.address}</span>
              <small>{retailer.area} · {retailer.phone}</small>
            </div>
          </Card>
        </aside>
      </div>

      <AllocationTraceModal open={traceOpen} order={order} onClose={() => setTraceOpen(false)} />
      <Modal
        open={Boolean(decision)}
        title={decision === 'cancel' ? `Hủy ${order.id}` : `Từ chối ${order.id}`}
        description="Lý do là bắt buộc và sẽ được gửi cho Sales cùng retailer."
        onClose={() => setDecision(undefined)}
        width="small"
      >
        <label className="field">
          <span>Lý do xử lý</span>
          <textarea
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Nhập lý do cụ thể…"
            autoFocus
          />
        </label>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setDecision(undefined)}>Đóng</Button>
          <Button variant="danger" disabled={!reason.trim()} onClick={submitDecision}>
            {decision === 'cancel' ? 'Xác nhận hủy' : 'Xác nhận từ chối'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function AllocationTraceModal({
  open,
  order,
  onClose,
}: {
  open: boolean
  order: PortalOrder
  onClose: () => void
}) {
  const [sku, setSku] = useState(order.lines[0]?.sku ?? 'SKU001')
  const line = order.lines.find((item) => item.sku === sku) ?? order.lines[0]
  const allocations = order.allocations.filter((item) => item.sku === line?.sku)
  const steps = [
    { code: 'B1', title: 'Lọc batch còn hạn', text: 'Loại batch đã hết hạn tại ngày xuất dự kiến 28/09/2026.' },
    { code: 'B2a', title: 'Lọc phạm vi phục vụ', text: 'Chỉ giữ kho trong bán kính Dmax = 20 km từ retailer.' },
    { code: 'B2b', title: 'Kiểm tra MLOR', text: 'Batch phải còn đủ thời gian bán tối thiểu theo SKU.' },
    { code: 'B3', title: 'Chấm điểm ứng viên', text: 'S = 0.5 × FEFO + 0.3 × khoảng cách + 0.2 × độ phủ tồn.' },
    { code: 'B4–B5', title: 'Cấp phát greedy', text: 'Lấy ứng viên điểm cao nhất cho tới khi đủ toàn bộ số lượng; không giao một phần.' },
  ]
  return (
    <Modal
      open={open}
      title="Giải thích phân bổ B1–B5"
      description={`${order.id} · tính trên tồn khả dụng tại thời điểm hệ thống xử lý đơn`}
      onClose={onClose}
      width="large"
    >
      <div className="trace-tabs">
        {order.lines.map((item) => (
          <button
            key={item.sku}
            type="button"
            className={sku === item.sku ? 'active' : ''}
            onClick={() => setSku(item.sku)}
          >
            {item.sku} × {item.quantity}
          </button>
        ))}
      </div>
      <div className="trace-layout">
        <ol className="trace-steps">
          {steps.map((step) => (
            <li key={step.code}>
              <span>{step.code}</span>
              <div><strong>{step.title}</strong><p>{step.text}</p></div>
            </li>
          ))}
        </ol>
        <Card className="trace-result">
          <span className="section-kicker">Kết quả {line?.sku}</span>
          <h3>{allocations.length ? 'Đủ hàng hợp lệ' : 'Không đủ hàng hợp lệ'}</h3>
          {allocations.map((allocation) => (
            <div key={allocation.batchCode}>
              <strong>{allocation.quantity} thùng</strong>
              <span>{allocation.warehouse}</span>
              <small>{allocation.batchCode}</small>
            </div>
          ))}
          <p>
            {allocations.length
              ? 'Hệ thống tạm giữ đúng kho–batch–số lượng. Khi duyệt, phần giữ chuyển Reserved và sinh picking list theo kho.'
              : 'Đơn bị từ chối toàn bộ; hệ thống không tự hạ MLOR hoặc nới phạm vi phục vụ.'}
          </p>
        </Card>
      </div>
    </Modal>
  )
}
