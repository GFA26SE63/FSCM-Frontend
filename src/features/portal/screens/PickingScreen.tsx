import { useMemo, useState } from 'react'
import { PackageCheck, QrCode } from 'lucide-react'
import type { ResourceRow } from '../../../shared/domain/portal'
import { statusTone } from '../../../shared/lib/status'
import { DataTable, FilterToolbar, PageHeader } from '../../../shared/components/portalComponents'
import { Button, Modal, StatusBadge } from '../../../shared/ui'
import { products } from '../data/demoData'
import { usePortalStore } from '../state/portalStore'

interface PickingView {
  id: string
  orderId: string
  warehouse: string
  status: string
  lines: Array<{ sku: string; batch: string; quantity: number; expiry: string }>
}

export function PickingScreen() {
  const orders = usePortalStore((state) => state.orders)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PickingView>()
  const pickings = useMemo(() => {
    const result: PickingView[] = []
    orders
      .filter((order) => ['Đã duyệt', 'Đã xuất kho', 'Đang giao', 'Đã giao'].includes(order.status))
      .forEach((order) => {
        const groups = new Map<string, typeof order.allocations>()
        order.allocations.forEach((allocation) => {
          groups.set(allocation.warehouse, [...(groups.get(allocation.warehouse) ?? []), allocation])
        })
        ;[...groups.entries()].forEach(([warehouse, allocations], index) => {
          result.push({
            id: `${order.id}${String.fromCharCode(65 + index)}`,
            orderId: order.id,
            warehouse,
            status: order.status === 'Đã duyệt' ? 'Chưa pick' : 'Đã xuất',
            lines: allocations.map((allocation) => ({
              sku: allocation.sku,
              batch: allocation.batchCode,
              quantity: allocation.quantity,
              expiry: allocation.expiryDate,
            })),
          })
        })
      })
    return result
  }, [orders])
  const filtered = pickings.filter((item) =>
    `${item.id} ${item.orderId} ${item.warehouse}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')),
  )
  const rows: ResourceRow[] = filtered.map((item) => ({
    id: item.id,
    code: item.id,
    order: item.orderId,
    warehouse: item.warehouse,
    lines: item.lines.length,
    quantity: `${item.lines.reduce((sum, line) => sum + line.quantity, 0)} thùng`,
    status: item.status,
  }))
  return (
    <div className="page-stack">
      <PageHeader title="Picking list" description="Danh sách lấy hàng được sinh theo từng kho sau khi đơn được duyệt." />
      <FilterToolbar query={query} onQueryChange={setQuery} placeholder="Mã picking, mã đơn hoặc kho…" resultCount={rows.length} />
      <DataTable
        columns={[
          { key: 'code', label: 'Mã picking' },
          { key: 'order', label: 'Mã đơn' },
          { key: 'warehouse', label: 'Kho' },
          { key: 'lines', label: 'Số dòng' },
          { key: 'quantity', label: 'Tổng số lượng' },
          { key: 'status', label: 'Trạng thái' },
        ]}
        rows={rows}
        actionLabel="Mở picking"
        onRowClick={(row) => setSelected(pickings.find((item) => item.id === row.id))}
      />
      <Modal
        open={Boolean(selected)}
        title={`Picking list ${selected?.id ?? ''}`}
        description={`${selected?.orderId ?? ''} · ${selected?.warehouse ?? ''}`}
        onClose={() => setSelected(undefined)}
        width="large"
      >
        {selected && (
          <>
            <div className="picking-summary">
              <div><span>Kho thực hiện</span><strong>{selected.warehouse}</strong></div>
              <div><span>Số dòng</span><strong>{selected.lines.length}</strong></div>
              <div><span>Trạng thái</span><StatusBadge tone={statusTone(selected.status)}>{selected.status}</StatusBadge></div>
            </div>
            <div className="picking-lines">
              {selected.lines.map((line) => (
                <article key={`${line.sku}-${line.batch}`}>
                  <div className="picking-lines__icon"><PackageCheck size={20} /></div>
                  <div><strong>{line.sku} · {products[line.sku].name}</strong><span>{line.batch}</span><small>HSD {line.expiry}</small></div>
                  <b>{line.quantity} thùng</b>
                </article>
              ))}
            </div>
            {selected.status !== 'Đã xuất' && (
              <div className="modal-actions">
                <Button icon={<QrCode size={17} />} onClick={() => setSelected(undefined)}>Mở trên Warehouse App</Button>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
