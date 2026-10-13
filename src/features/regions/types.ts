export interface Area { code: string; name: string; region: string; managerName: string; wards: string[]; groups: string[]; retailerCount: number }
export interface GroupMember { name: string; groupCode: string; revenueAfterPromo: number; revenueBeforePromo: number }
export interface SalesGroup { code: string; areaCode: string; areaName: string; managerName: string; members: string[]; retailerCount: number; memberRows: GroupMember[] }
export interface SalesStaff { name: string; groupCode: string | null }
export interface AreaInput { code: string; name: string; region: string; managerName: string }
export interface GroupInput { code: string; areaCode: string; managerName: string; members: string[] }
export interface TransferInput { name: string; toGroup: string; effectiveDate?: string }
