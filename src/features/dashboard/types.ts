import type { PortalRole } from '@/shared/auth/roles';
export interface DashboardFilters { fromDate: string; toDate: string; regionId?: string; warehouseId?: string; salesGroupId?: string }
export interface DashboardOption { id: string; code: string; name: string; regionId: string | null }
export interface DashboardCard { key: string; label: string; value: number; unit: 'VND' | 'count' | 'carton' | 'percent'; note: string; tone: string; href?: string | null }
export interface DashboardDay { date: string; recognizedRevenue: number; collectedAmount: number }
export interface DashboardResponse {
  role: PortalRole; asOf: string; fromDate: string; toDate: string;
  scope: { isGlobal: boolean; hasAssignments: boolean; description: string; regions: DashboardOption[]; warehouses: DashboardOption[]; salesGroups: DashboardOption[] };
  cards: DashboardCard[];
  ordersByStatus: { status: string; count: number }[];
  revenueByDay: DashboardDay[];
  topProducts: { id: string; sku: string; name: string; quantity: number; revenue: number }[];
  salesTeam: { id: string; name: string; groupId: string; groupCode: string; completedOrders: number; retailersServed: number; revenue: number; kpiCompletion: number | null }[];
  inventory: { id: string; code: string; name: string; onHand: number; reserved: number; locked: number; available: number; nearExpiry: number; expired: number }[];
  expiryRisks: { id: string; batchCode: string; warehouseCode: string; sku: string; expirationDate: string; onHand: number; available: number; status: string }[];
  workItems: { kind: string; id: string; code: string; title: string; status: string; reason: string; since: string; priority: number; href: string | null; amount: number | null }[];
  customers: { id: string; code: string; name: string; status: string; periodOrders: number; lastOrderAt: string | null; expectedFrequencyPerMonth: number; outstanding: number; overdue: number }[];
  health: { expiryLastRunAt: string | null; expiryStatus: string | null; pendingEvents: number; failedEvents: number; abandonedAllocations: number } | null;
  unattributedRevenue: number | null; notes: string[];
}
