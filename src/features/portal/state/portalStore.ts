import { create } from 'zustand'
import type {
  OrderStatus,
  PortalOrder,
  PortalPage,
  PortalRole,
} from '../../../shared/domain/portal'
import { initialOrders } from '../data/demoData'

interface PortalState {
  authenticated: boolean
  role: PortalRole
  activePage: PortalPage
  sidebarOpen: boolean
  orders: PortalOrder[]
  login: () => void
  logout: () => void
  setRole: (role: PortalRole) => void
  setActivePage: (page: PortalPage) => void
  setSidebarOpen: (open: boolean) => void
  approveOrder: (orderId: string) => void
  closeOrder: (
    orderId: string,
    status: Extract<OrderStatus, 'Bị từ chối' | 'Đã hủy'>,
    reason: string,
  ) => void
}

const firstPageByRole: Record<PortalRole, PortalPage> = {
  Admin: 'orders',
  Operator: 'orders',
  'Warehouse Keeper': 'picking',
  'Sales Manager': 'regions',
}

export const usePortalStore = create<PortalState>((set) => ({
  authenticated: false,
  role: 'Admin',
  activePage: 'orders',
  sidebarOpen: false,
  orders: initialOrders,
  login: () => set({ authenticated: true }),
  logout: () => set({ authenticated: false, activePage: 'orders' }),
  setRole: (role) =>
    set({ role, activePage: firstPageByRole[role], sidebarOpen: false }),
  setActivePage: (activePage) => set({ activePage, sidebarOpen: false }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  approveOrder: (orderId) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: 'Đã duyệt',
              reviewer:
                state.role === 'Admin'
                  ? 'Phạm Minh Khoa (Admin)'
                  : 'Lý Thu Trang (Operator)',
              timeline: [
                ...order.timeline,
                {
                  time: '27/09 10:45',
                  label: `${state.role} duyệt đơn – chuyển hàng tạm giữ sang Reserved và sinh picking list`,
                },
              ],
            }
          : order,
      ),
    })),
  closeOrder: (orderId, status, reason) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status,
              rejectionReason: reason,
              timeline: [
                ...order.timeline,
                {
                  time: '27/09 10:48',
                  label: `${state.role} ${status === 'Đã hủy' ? 'hủy' : 'từ chối'} đơn: ${reason} – trả hàng tạm giữ`,
                },
              ],
            }
          : order,
      ),
    })),
}))
