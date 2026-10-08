import type { ReactNode } from 'react'
import { ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import type {
  ResourceColumn,
  ResourceRow,
  ResourceValue,
} from '../domain/portal'
import { statusTone } from '../lib/status'
import { Card, StatusBadge } from '../ui'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}

export function PageHeader({
  eyebrow = 'FSCM Portal',
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <span className="page-header__eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}

interface FilterToolbarProps {
  query: string
  onQueryChange: (value: string) => void
  placeholder: string
  children?: ReactNode
  resultCount?: number
}

export function FilterToolbar({
  query,
  onQueryChange,
  placeholder,
  children,
  resultCount,
}: FilterToolbarProps) {
  return (
    <div className="filter-toolbar">
      <label className="search-control">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
      </label>
      {children && (
        <div className="filter-toolbar__filters">
          <SlidersHorizontal size={17} />
          {children}
        </div>
      )}
      {resultCount !== undefined && (
        <span className="filter-toolbar__count">{resultCount} kết quả</span>
      )}
    </div>
  )
}

interface DataTableProps {
  columns: ResourceColumn[]
  rows: ResourceRow[]
  onRowClick?: (row: ResourceRow) => void
  actionLabel?: string
  emptyMessage?: string
}

function renderCell(value: ResourceValue, key: string) {
  const text = String(value)
  if (key === 'status' || key === 'tier' || key === 'type') {
    return <StatusBadge tone={statusTone(text)}>{text}</StatusBadge>
  }
  return text
}

export function DataTable({
  columns,
  rows,
  onRowClick,
  actionLabel = 'Xem',
  emptyMessage = 'Không có dữ liệu phù hợp.',
}: DataTableProps) {
  return (
    <Card className="data-table-card">
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.align === 'right' ? 'align-right' : ''}>
                  {column.label}
                </th>
              ))}
              {onRowClick && <th aria-label="Thao tác" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={onRowClick ? 'data-table__clickable' : ''}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={column.align === 'right' ? 'align-right' : ''}>
                    {renderCell(row[column.key], column.key)}
                  </td>
                ))}
                {onRowClick && (
                  <td className="data-table__action">
                    <button type="button" onClick={() => onRowClick(row)}>
                      {actionLabel}
                      <ChevronRight size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty-table">{emptyMessage}</div>}
      </div>
    </Card>
  )
}

interface MetricCardProps {
  label: string
  value: string
  note: string
  tone?: 'default' | 'primary' | 'info' | 'danger'
  icon?: ReactNode
}

export function MetricCard({
  label,
  value,
  note,
  tone = 'default',
  icon,
}: MetricCardProps) {
  return (
    <Card className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__label">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </Card>
  )
}

export interface DetailItem {
  label: string
  value: ReactNode
}

export function DetailGrid({ items }: { items: DetailItem[] }) {
  return (
    <dl className="detail-grid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

interface TimelineProps {
  items: Array<{ time: string; label: string }>
}

export function Timeline({ items }: TimelineProps) {
  return (
    <ol className="timeline">
      {[...items].reverse().map((item, index) => (
        <li key={`${item.time}-${index}`}>
          <span className="timeline__dot" />
          <div>
            <strong>{item.label}</strong>
            <time>{item.time}</time>
          </div>
        </li>
      ))}
    </ol>
  )
}
