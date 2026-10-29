import { get, getAll, patch, post, put } from '@/shared/api/http';
import type {
  Area,
  AreaInput,
  GroupInput,
  GroupRetailerItem,
  SalesGroup,
  SalesStaff,
  TransferInput,
} from './types';

// OpenAPI RegionResult
interface RegionResult {
  id: string;
  code: string | null;
  name: string | null;
  description: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// OpenAPI SalesGroupResult
interface SalesGroupResult {
  id: string;
  regionId: string;
  regionCode: string | null;
  regionName: string | null;
  code: string | null;
  name: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// OpenAPI SalesGroupMembershipResult
interface SalesGroupMembershipResult {
  id: string;
  salesGroupId: string;
  salesGroupCode: string | null;
  userId: string;
  userEmail: string | null;
  userFullName: string | null;
  assignedAt: string;
  unassignedAt: string | null;
  isActive: boolean;
}

// OpenAPI RetailerTerritoryAssignmentResult
interface RetailerTerritoryAssignmentResult {
  id: string;
  retailerId: string;
  retailerCode: string | null;
  retailerName: string | null;
  address?: string | null;
  contact?: string | null;
  phone?: string | null;
  salesGroupId: string;
  salesGroupCode: string | null;
  assignedAt: string;
  unassignedAt: string | null;
  isActive: boolean;
}

// OpenAPI UserSummary
interface UserSummary {
  id: string;
  email: string | null;
  fullName: string | null;
  role: string | null;
  isActive: boolean;
}

// OpenAPI AuthenticatedUser with scope
interface UserWithScope extends UserSummary {
  scope?: {
    regionIds?: string[];
    salesGroupIds?: string[];
    warehouseIds?: string[];
    retailerIds?: string[];
  };
}

function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

const regionCodeToId = new Map<string, string>();
const groupCodeToId = new Map<string, string>();
const staffNameToId = new Map<string, string>();

async function resolveRegionId(codeOrId: string): Promise<string> {
  if (isUuid(codeOrId)) return codeOrId;
  const cached = regionCodeToId.get(codeOrId.toUpperCase());
  if (cached) return cached;
  await regionApi.areas();
  return regionCodeToId.get(codeOrId.toUpperCase()) ?? codeOrId;
}

async function resolveGroupId(codeOrId: string): Promise<string> {
  if (isUuid(codeOrId)) return codeOrId;
  const cached = groupCodeToId.get(codeOrId.toUpperCase());
  if (cached) return cached;
  await regionApi.groups();
  return groupCodeToId.get(codeOrId.toUpperCase()) ?? codeOrId;
}

export const regionApi = {
  /**
   * GET /api/v1/regions
   * Enriches regions with child sales groups, retailer counts, and assigned Sales Managers.
   */
  async areas(): Promise<Area[]> {
    const rawRegions = await getAll<RegionResult>('/regions', { includeInactive: true });

    // Fetch related sales groups to compute child groups and retailer counts
    let allGroups: SalesGroupResult[] = [];
    try {
      allGroups = await getAll<SalesGroupResult>('/sales-groups', { includeInactive: true });
    } catch {
      // Ignore if groups request fails
    }

    // Fetch related retailer territory assignments for accurate counts
    let retailerAssigns: RetailerTerritoryAssignmentResult[] = [];
    try {
      retailerAssigns = await getAll<RetailerTerritoryAssignmentResult>('/territory-assignments/retailers', {
        includeInactive: false,
      });
    } catch {
      // Ignore
    }

    // Fetch sales managers to match assigned region scope
    const managers = await regionApi.managers();

    return rawRegions.map((r) => {
      const regionId = r.id;
      const code = String(r.code ?? '');
      if (code && regionId) regionCodeToId.set(code.toUpperCase(), regionId);

      const childGroups = allGroups.filter(
        (g) => g.regionId === regionId || g.regionCode?.toUpperCase() === code.toUpperCase(),
      );
      const childGroupIds = new Set(childGroups.map((g) => g.id));
      const childGroupCodes = childGroups.map((g) => String(g.code ?? ''));

      const retailerCount = retailerAssigns.filter((a) => childGroupIds.has(a.salesGroupId)).length;

      // Find sales manager assigned to this region
      const matchedManager = managers.find((m) => m.assignedRegionIds?.includes(regionId));

      return {
        id: regionId,
        code,
        name: String(r.name ?? code),
        description: r.description ?? '',
        managerId: matchedManager?.id ?? null,
        managerName: matchedManager?.name ?? 'Chưa phân công',
        groups: childGroupCodes,
        retailerCount,
        isActive: r.isActive,
      };
    });
  },

  /**
   * POST /api/v1/regions
   * Body: CreateRegionRequest { code, name, description } (additionalProperties: false)
   */
  async createArea(v: AreaInput): Promise<Area> {
    const codeUpper = v.code.trim().toUpperCase();
    const payload = {
      code: codeUpper,
      name: v.name.trim(),
      description: v.description?.trim() || null,
    };

    const res = await post<RegionResult>('/regions', payload);
    const createdId = res?.id;
    if (createdId && codeUpper) {
      regionCodeToId.set(codeUpper, createdId);
    }

    // Assign SalesManager scope if selected
    if (v.managerId && createdId && isUuid(v.managerId) && isUuid(createdId)) {
      try {
        await put(`/users/${v.managerId}/scope/regions/${createdId}`);
      } catch {
        // Scope assign error handled gracefully
      }
    }

    return {
      id: createdId,
      code: codeUpper,
      name: payload.name,
      description: payload.description ?? '',
      managerId: v.managerId ?? null,
      managerName: 'Chưa phân công',
      groups: [],
      retailerCount: 0,
      isActive: true,
    };
  },

  /**
   * PUT /api/v1/regions/{regionId}
   * Body: UpdateRegionRequest { name, description } (additionalProperties: false, NO code)
   */
  async updateArea(idOrCode: string, v: Partial<AreaInput>): Promise<Area> {
    const target = await resolveRegionId(idOrCode);
    const payload = {
      name: (v.name ?? '').trim(),
      description: v.description?.trim() || null,
    };

    const res = await put<RegionResult>(`/regions/${target}`, payload);

    if (v.managerId && isUuid(v.managerId) && isUuid(target)) {
      try {
        await put(`/users/${v.managerId}/scope/regions/${target}`);
      } catch {
        // Ignore scope error
      }
    }

    return {
      id: isUuid(target) ? target : res?.id,
      code: String(res?.code ?? idOrCode),
      name: String(res?.name ?? payload.name),
      description: res?.description ?? payload.description ?? '',
      managerId: v.managerId ?? null,
      managerName: 'Chưa phân công',
      groups: [],
      retailerCount: 0,
      isActive: res?.isActive ?? true,
    };
  },

  /**
   * PATCH /api/v1/regions/{regionId}/status
   * Body: UpdateTerritoryStatusRequest { isActive } (additionalProperties: false)
   */
  async updateAreaStatus(idOrCode: string, isActive: boolean): Promise<void> {
    const target = await resolveRegionId(idOrCode);
    await patch(`/regions/${target}/status`, { isActive });
  },

  /**
   * GET /api/v1/sales-groups
   * Enriches sales groups with real members, retailer counts, and assigned Sales Managers.
   */
  async groups(): Promise<SalesGroup[]> {
    const rawGroups = await getAll<SalesGroupResult>('/sales-groups', { includeInactive: true });

    // 1. Fetch sales members assignments
    let salesAssigns: SalesGroupMembershipResult[] = [];
    try {
      salesAssigns = await getAll<SalesGroupMembershipResult>('/territory-assignments/sales', {
        includeInactive: false,
      });
      salesAssigns.forEach((a) => {
        if (a.userFullName && a.userId) staffNameToId.set(a.userFullName, a.userId);
      });
    } catch {
      // Ignore
    }

    // 2. Fetch retailer assignments
    let retailerAssigns: RetailerTerritoryAssignmentResult[] = [];
    try {
      retailerAssigns = await getAll<RetailerTerritoryAssignmentResult>('/territory-assignments/retailers', {
        includeInactive: false,
      });
    } catch {
      // Ignore
    }

    // 3. Fetch managers
    const managers = await regionApi.managers();

    return rawGroups.map((g) => {
      const groupId = g.id;
      const code = String(g.code ?? '');
      if (code && groupId) groupCodeToId.set(code.toUpperCase(), groupId);

      const matchedSales = salesAssigns.filter(
        (a) => a.salesGroupId === groupId || a.salesGroupCode?.toUpperCase() === code.toUpperCase(),
      );
      const members = matchedSales.map((a) => a.userFullName || '—');
      const memberRows = matchedSales.map((a) => ({
        userId: a.userId,
        name: a.userFullName || '—',
        groupCode: code,
        revenueAfterPromo: 0,
        revenueBeforePromo: 0,
      }));

      const retailerCount = retailerAssigns.filter(
        (a) => a.salesGroupId === groupId || a.salesGroupCode?.toUpperCase() === code.toUpperCase(),
      ).length;

      // Find Sales Manager assigned to this group or region
      const matchedManager = managers.find(
        (m) => m.assignedSalesGroupIds?.includes(groupId) || (g.regionId && m.assignedRegionIds?.includes(g.regionId)),
      );

      return {
        id: groupId,
        regionId: g.regionId,
        code,
        name: g.name ?? code,
        areaCode: String(g.regionCode ?? ''),
        areaName: String(g.regionName ?? g.regionCode ?? ''),
        managerId: matchedManager?.id ?? null,
        managerName: matchedManager?.name ?? 'Chưa phân công',
        members,
        memberRows,
        retailerCount,
        isActive: g.isActive,
      };
    });
  },

  /**
   * GET /api/v1/sales-groups/{salesGroupId}
   */
  async group(codeOrId: string): Promise<SalesGroup> {
    const target = await resolveGroupId(codeOrId);
    const res = await get<SalesGroupResult>(`/sales-groups/${target}`);
    const groupId = res.id || target;
    const code = String(res.code ?? codeOrId);

    // Fetch members assigned to this group
    let matchedSales: SalesGroupMembershipResult[] = [];
    try {
      matchedSales = await getAll<SalesGroupMembershipResult>('/territory-assignments/sales', {
        salesGroupId: groupId,
        includeInactive: false,
      });
      matchedSales.forEach((a) => {
        if (a.userFullName && a.userId) staffNameToId.set(a.userFullName, a.userId);
      });
    } catch {
      // Ignore
    }

    // Fetch retailer count
    let retailerCount = 0;
    try {
      const retailers = await getAll<RetailerTerritoryAssignmentResult>('/territory-assignments/retailers', {
        salesGroupId: groupId,
        includeInactive: false,
      });
      retailerCount = retailers.length;
    } catch {
      // Ignore
    }

    // Match manager
    const managers = await regionApi.managers();
    const matchedManager = managers.find(
      (m) => m.assignedSalesGroupIds?.includes(groupId) || (res.regionId && m.assignedRegionIds?.includes(res.regionId)),
    );

    return {
      id: groupId,
      regionId: res.regionId,
      code,
      name: res.name ?? code,
      areaCode: String(res.regionCode ?? ''),
      areaName: String(res.regionName ?? res.regionCode ?? ''),
      managerId: matchedManager?.id ?? null,
      managerName: matchedManager?.name ?? 'Chưa phân công',
      members: matchedSales.map((a) => a.userFullName || '—'),
      memberRows: matchedSales.map((a) => ({
        userId: a.userId,
        name: a.userFullName || '—',
        groupCode: code,
        revenueAfterPromo: 0,
        revenueBeforePromo: 0,
      })),
      retailerCount,
      isActive: res.isActive,
    };
  },

  /**
   * POST /api/v1/sales-groups
   * Body: CreateSalesGroupRequest { regionId: uuid, code: string, name: string } (additionalProperties: false)
   */
  async createGroup(v: GroupInput): Promise<SalesGroup> {
    const codeUpper = v.code.trim().toUpperCase();
    const regionId = await resolveRegionId(v.areaCode);

    const payload = {
      regionId,
      code: codeUpper,
      name: v.name?.trim() || codeUpper,
    };

    const res = await post<SalesGroupResult>('/sales-groups', payload);
    const createdId = res.id;
    if (createdId && codeUpper) {
      groupCodeToId.set(codeUpper, createdId);
    }

    // Assign SalesManager scope if selected
    if (v.managerId && createdId && isUuid(v.managerId) && isUuid(createdId)) {
      try {
        await put(`/users/${v.managerId}/scope/sales-groups/${createdId}`);
      } catch {
        // Ignore scope error
      }
    }

    // Assign member sales staff via PUT /api/v1/territory-assignments/sales/{userId}
    if (createdId && isUuid(createdId)) {
      // Ensure staffNameToId is populated
      if (staffNameToId.size === 0) {
        await regionApi.staff();
      }
      for (const memberName of v.members) {
        const userId = staffNameToId.get(memberName);
        if (userId && isUuid(userId)) {
          try {
            await put(`/territory-assignments/sales/${userId}`, {
              destinationSalesGroupId: createdId,
            });
          } catch {
            // Continue with other members
          }
        }
      }
    }

    return {
      id: createdId,
      regionId,
      code: codeUpper,
      name: payload.name,
      areaCode: v.areaCode,
      areaName: v.areaCode,
      managerId: v.managerId ?? null,
      managerName: v.managerName ?? 'Chưa phân công',
      members: v.members,
      memberRows: v.members.map((m) => ({
        name: m,
        groupCode: codeUpper,
        revenueAfterPromo: 0,
        revenueBeforePromo: 0,
      })),
      retailerCount: 0,
      isActive: true,
    };
  },

  /**
   * PUT /api/v1/sales-groups/{salesGroupId}
   * Body: UpdateSalesGroupRequest { name: string } (additionalProperties: false, NO code, NO regionId)
   */
  async updateGroup(v: GroupInput): Promise<SalesGroup> {
    const target = await resolveGroupId(v.code);
    const payload = {
      name: v.name?.trim() || v.code.trim().toUpperCase(),
    };

    const res = await put<SalesGroupResult>(`/sales-groups/${target}`, payload);
    const groupId = isUuid(target) ? target : res.id;

    // Update manager scope
    if (v.managerId && isUuid(v.managerId) && isUuid(groupId)) {
      try {
        await put(`/users/${v.managerId}/scope/sales-groups/${groupId}`);
      } catch {
        // Ignore
      }
    }

    // Assign members to this group
    if (isUuid(groupId)) {
      if (staffNameToId.size === 0) {
        await regionApi.staff();
      }
      for (const memberName of v.members) {
        const userId = staffNameToId.get(memberName);
        if (userId && isUuid(userId)) {
          try {
            await put(`/territory-assignments/sales/${userId}`, {
              destinationSalesGroupId: groupId,
            });
          } catch {
            // Continue
          }
        }
      }
    }

    return {
      id: groupId,
      regionId: res.regionId,
      code: v.code,
      name: payload.name,
      areaCode: v.areaCode,
      areaName: v.areaCode,
      managerId: v.managerId ?? null,
      managerName: v.managerName ?? 'Chưa phân công',
      members: v.members,
      memberRows: v.members.map((m) => ({
        name: m,
        groupCode: v.code,
        revenueAfterPromo: 0,
        revenueBeforePromo: 0,
      })),
      retailerCount: 0,
      isActive: res.isActive ?? true,
    };
  },

  /**
   * PATCH /api/v1/sales-groups/{salesGroupId}/status
   * Body: UpdateTerritoryStatusRequest { isActive } (additionalProperties: false)
   */
  async updateGroupStatus(idOrCode: string, isActive: boolean): Promise<void> {
    const target = await resolveGroupId(idOrCode);
    await patch(`/sales-groups/${target}/status`, { isActive });
  },

  /**
   * Real Sales staff directory:
   * 1. GET /api/v1/users?role=Sales (all Sales users in system)
   * 2. GET /api/v1/territory-assignments/sales (current group assignments)
   */
  async staff(): Promise<SalesStaff[]> {
    // 1. Fetch all users with role Sales
    const users = await getAll<UserSummary>('/users', { role: 'Sales' });

    // 2. Fetch current territory assignments
    let assigns: SalesGroupMembershipResult[] = [];
    try {
      assigns = await getAll<SalesGroupMembershipResult>('/territory-assignments/sales', {
        includeInactive: false,
      });
    } catch {
      // Ignore
    }

    return users.map((u) => {
      const name = u.fullName || u.email || '—';
      staffNameToId.set(name, u.id);

      const matchedAssign = assigns.find((a) => a.userId === u.id);

      return {
        userId: u.id,
        name,
        email: u.email ?? undefined,
        groupCode: matchedAssign?.salesGroupCode ?? null,
        groupId: matchedAssign?.salesGroupId ?? null,
      };
    });
  },

  /**
   * Real Sales Managers directory:
   * GET /api/v1/users?role=SalesManager
   * Also fetches scope for each manager to know which regions/groups they oversee.
   */
  async managers(): Promise<{
    id: string;
    name: string;
    assignedRegionIds?: string[];
    assignedSalesGroupIds?: string[];
  }[]> {
    const users = await getAll<UserSummary>('/users', { role: 'SalesManager' });

    const results = await Promise.all(
      users.map(async (u) => {
        let assignedRegionIds: string[] = [];
        let assignedSalesGroupIds: string[] = [];
        try {
          const detail = await get<UserWithScope>(`/users/${u.id}`);
          if (detail?.scope) {
            assignedRegionIds = detail.scope.regionIds ?? [];
            assignedSalesGroupIds = detail.scope.salesGroupIds ?? [];
          }
        } catch {
          // If detail call fails, proceed with empty scopes
        }
        return {
          id: u.id,
          name: u.fullName || u.email || '—',
          assignedRegionIds,
          assignedSalesGroupIds,
        };
      }),
    );

    return results;
  },

  /**
   * GET /api/v1/territory-assignments/retailers?salesGroupId={salesGroupId}
   */
  async retailersInGroup(groupCodeOrId: string): Promise<GroupRetailerItem[]> {
    const targetGroupId = await resolveGroupId(groupCodeOrId);
    const assigns = await getAll<RetailerTerritoryAssignmentResult>('/territory-assignments/retailers', {
      salesGroupId: targetGroupId,
      includeInactive: false,
    });

    return assigns.map((a) => ({
      id: a.retailerId,
      code: String(a.retailerCode ?? ''),
      name: String(a.retailerName ?? a.retailerCode ?? ''),
      address: a.address ?? '—',
      contact: a.contact ?? '—',
      phone: a.phone ?? '—',
      status: a.isActive ? 'Active' : 'Locked',
    }));
  },

  /**
   * PUT /api/v1/territory-assignments/sales/{userId}
   * Body: TransferSalesRequest { destinationSalesGroupId: uuid } (additionalProperties: false)
   */
  async transfer(v: TransferInput): Promise<{ name: string; fromGroup: string | null; toGroup: string; effectiveDate?: string }> {
    let userId = v.userId || staffNameToId.get(v.name);
    if (!userId) {
      await regionApi.staff();
      userId = staffNameToId.get(v.name);
    }

    if (!userId || !isUuid(userId)) {
      throw new Error(`Không xác định được mã nhân viên (userId) của Sales "${v.name}".`);
    }

    const destGroupId = v.destinationSalesGroupId || (await resolveGroupId(v.toGroup));
    if (!destGroupId || !isUuid(destGroupId)) {
      throw new Error(`Không xác định được mã nhóm bán hàng đích (UUID) cho nhóm "${v.toGroup}".`);
    }

    await put(`/territory-assignments/sales/${userId}`, {
      destinationSalesGroupId: destGroupId,
    });

    return {
      name: v.name,
      fromGroup: null,
      toGroup: v.toGroup,
      effectiveDate: v.effectiveDate,
    };
  },
};
