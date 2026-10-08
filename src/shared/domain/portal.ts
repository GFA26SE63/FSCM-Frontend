export type PortalRole =
  | 'Admin'
  | 'Operator'
  | 'Warehouse Keeper'
  | 'Sales Manager'

export type PortalPage =
  | 'dashboard'
  | 'orders'
  | 'debts'
  | 'picking'
  | 'receipts'
  | 'transfers'
  | 'batches'
  | 'batchPromotions'
  | 'disposals'
  | 'promotions'
  | 'retailers'
  | 'loyalty'
  | 'regions'
  | 'categories'
  | 'products'
  | 'warehouses'
  | 'users'
  | 'salesKpi'
  | 'complaints'
  | 'configuration'

export type OrderStatus =
  | 'Chờ duyệt'
  | 'Đã duyệt'
  | 'Đã xuất kho'
  | 'Đang giao'
  | 'Đã giao'
  | 'Bị từ chối'
  | 'Đã hủy'

export interface Product {
  sku: string
  name: string
  category: string
  pack: string
  price: number
  shelfLifeDays: number
}

export interface Retailer {
  id: string
  name: string
  address: string
  area: string
  phone: string
}

export interface OrderLine {
  sku: string
  quantity: number
  discountPercent: number
}

export interface Allocation {
  sku: string
  warehouse: string
  batchCode: string
  expiryDate: string
  quantity: number
  distanceKm: number
}

export interface TimelineEvent {
  time: string
  label: string
}

export interface DeliveryInfo {
  plate: string
  driver: string
  phone: string
  departedAt: string
}

export interface PortalOrder {
  id: string
  retailerId: string
  lines: OrderLine[]
  status: OrderStatus
  createdAt: string
  createdBy: string
  channel: 'Online' | 'Offline'
  syncedAt?: string
  payment: string
  paymentStatus: string
  reviewer?: string
  rejectionReason?: string
  promotionChanged?: boolean
  localDiscount?: number
  delivery?: DeliveryInfo
  allocations: Allocation[]
  timeline: TimelineEvent[]
}

export interface ResourceColumn {
  key: string
  label: string
  align?: 'left' | 'right'
}

export type ResourceValue = string | number

export interface ResourceRow {
  id: string
  [key: string]: ResourceValue
}

export interface ResourceDefinition {
  title: string
  description: string
  searchPlaceholder: string
  columns: ResourceColumn[]
  rows: ResourceRow[]
  primaryAction?: string
}
