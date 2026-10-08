import { useMemo, useState } from 'react'
import { Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import type { PortalPage, ResourceRow } from '../../../shared/domain/portal'
import { statusTone } from '../../../shared/lib/status'
import { DataTable, FilterToolbar, PageHeader } from '../../../shared/components/portalComponents'
import { Button, Modal, StatusBadge } from '../../../shared/ui'
import { resourceDefinitions } from '../data/demoData'

export function ResourceScreen({ page }: { page: PortalPage }) {
  const definition = resourceDefinitions[page]
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ResourceRow>()
  const [formOpen, setFormOpen] = useState(false)
  const rows = useMemo(() => {
    if (!definition) return []
    const normalized = query.toLocaleLowerCase('vi').trim()
    if (!normalized) return definition.rows
    return definition.rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLocaleLowerCase('vi').includes(normalized),
      ),
    )
  }, [definition, query])

  if (!definition) return null

  return (
    <div className="page-stack">
      <PageHeader
        title={definition.title}
        description={definition.description}
        actions={definition.primaryAction ? (
          <Button icon={<Plus size={17} />} onClick={() => setFormOpen(true)}>
            {definition.primaryAction}
          </Button>
        ) : undefined}
      />
      <FilterToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder={definition.searchPlaceholder}
        resultCount={rows.length}
      />
      <DataTable columns={definition.columns} rows={rows} onRowClick={setSelected} />
      <Modal
        open={Boolean(selected)}
        title={selected ? String(selected[definition.columns[0].key]) : ''}
        description={`Chi tiết ${definition.title.toLocaleLowerCase('vi')}`}
        onClose={() => setSelected(undefined)}
      >
        {selected && (
          <div className="resource-detail">
            {definition.columns.map((column) => (
              <div key={column.key}>
                <span>{column.label}</span>
                {column.key === 'status' ? (
                  <StatusBadge tone={statusTone(String(selected[column.key]))}>
                    {String(selected[column.key])}
                  </StatusBadge>
                ) : (
                  <strong>{String(selected[column.key])}</strong>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
      <Modal
        open={formOpen}
        title={definition.primaryAction ?? ''}
        description="Biểu mẫu dùng chung giữ cấu trúc và kiểm tra dữ liệu nhất quán giữa các module."
        onClose={() => setFormOpen(false)}
      >
        <div className="resource-form-grid">
          <label className="field"><span>Mã tham chiếu</span><input placeholder="Hệ thống tự sinh nếu để trống" /></label>
          <label className="field"><span>Đơn vị / phạm vi</span><select><option>Toàn hệ thống</option><option>Kho Thới An</option><option>Quận 12</option></select></label>
          <label className="field resource-form-grid__wide"><span>Nội dung</span><textarea rows={4} placeholder="Nhập thông tin nghiệp vụ…" /></label>
        </div>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setFormOpen(false)}>Hủy</Button>
          <Button
            icon={<Save size={17} />}
            onClick={() => {
              setFormOpen(false)
              toast.success('Đã lưu dữ liệu mô phỏng. Kết nối API vẫn đang chờ triển khai.')
            }}
          >
            Lưu
          </Button>
        </div>
      </Modal>
    </div>
  )
}
