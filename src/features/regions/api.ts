import { get, getAll, patch, post, put } from '@/shared/api/http';
import { env } from '@/shared/lib';
import type {
  Area,
  AreaInput,
  GroupInput,
  GroupRetailerItem,
  SalesGroup,
  SalesStaff,
  TransferInput,
} from './types';

interface RawRegion {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  region?: string;
  managerName?: string;
  wards?: string[];
  groups?: string[];
  retailerCount?: number;
}

interface RawSalesGroup {
  id?: string;
  regionId?: string;
  regionCode?: string;
  regionName?: string;
  code?: string;
  name?: string;
  areaCode?: string;
  areaName?: string;
  managerName?: string;
  members?: string[];
  retailerCount?: number;
  memberRows?: {
    name: string;
    groupCode: string;
    revenueAfterPromo: number;
    revenueBeforePromo: number;
  }[];
  isActive?: boolean;
}

interface RawMembership {
  id?: string;
  salesGroupId?: string;
  salesGroupCode?: string;
  userId?: string;
  userEmail?: string;
  userFullName?: string;
  assignedAt?: string;
  unassignedAt?: string | null;
  isActive?: boolean;
}

function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

const regionCodeToId = new Map<string, string>();
const groupCodeToId = new Map<string, string>();
const staffNameToId = new Map<string, string>();

function normalizeArea(raw: RawRegion): Area {
  if (raw.code && raw.id) regionCodeToId.set(raw.code.toUpperCase(), raw.id);
  return {
    id: raw.id,
    code: String(raw.code ?? ''),
    name: String(raw.name ?? ''),
    region: raw.region ?? raw.description ?? 'Miền Nam',
    managerName: raw.managerName ?? 'Hồ Gia Bảo',
    wards: raw.wards ?? (raw.description ? raw.description.split(',').map((s) => s.trim()) : []),
    groups: raw.groups ?? [],
    retailerCount: typeof raw.retailerCount === 'number' ? raw.retailerCount : 0,
    isActive: raw.isActive ?? true,
  };
}

function normalizeGroup(raw: RawSalesGroup): SalesGroup {
  if (raw.code && raw.id) groupCodeToId.set(raw.code.toUpperCase(), raw.id);
  const code = String(raw.code ?? '');
  const areaCode = String(raw.areaCode ?? raw.regionCode ?? 'Q12');
  const areaName = String(raw.areaName ?? raw.regionName ?? areaCode);
  const members = Array.isArray(raw.members) ? raw.members : [];
  return {
    id: raw.id,
    regionId: raw.regionId,
    code,
    name: raw.name ?? code,
    areaCode,
    areaName,
    managerName: raw.managerName ?? 'Hồ Gia Bảo',
    members,
    retailerCount: typeof raw.retailerCount === 'number' ? raw.retailerCount : 0,
    memberRows:
      raw.memberRows ??
      members.map((m) => ({
        name: m,
        groupCode: code,
        revenueAfterPromo: 0,
        revenueBeforePromo: 0,
      })),
    isActive: raw.isActive ?? true,
  };
}

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
  async areas(): Promise<Area[]> {
    try {
      const res = await getAll<RawRegion>('/regions', { includeInactive: true });
      if (Array.isArray(res) && res.length > 0) {
        return res.map(normalizeArea);
      }
    } catch {
      // Fallback to legacy /areas
    }
    const res = await getAll<Area>('/areas');
    return res.map(normalizeArea);
  },

  async createArea(v: AreaInput): Promise<Area> {
    const codeUpper = v.code.trim().toUpperCase();
    const payload = {
      code: codeUpper,
      name: v.name.trim(),
      description: v.wards?.join(', ') || v.region || v.name.trim(),
      ...(env.useMock ? { region: v.region, managerName: v.managerName, wards: v.wards } : {}),
    };
    try {
      const res = await post<RawRegion>('/regions', payload);
      return normalizeArea({ ...payload, ...res });
    } catch {
      const res = await post<Area>('/areas', { ...v, code: codeUpper });
      return normalizeArea(res);
    }
  },

  async updateArea(idOrCode: string, v: { name: string; description?: string; region?: string; wards?: string[] }): Promise<Area> {
    const target = await resolveRegionId(idOrCode);
    const payload = {
      name: v.name.trim(),
      description: v.wards?.join(', ') || v.region || v.name.trim(),
    };
    const res = await put<RawRegion>(`/regions/${target}`, payload);
    return normalizeArea({ ...res, id: isUuid(target) ? target : res?.id });
  },

  async updateAreaStatus(idOrCode: string, isActive: boolean): Promise<void> {
    const target = await resolveRegionId(idOrCode);
    await patch(`/regions/${target}/status`, { isActive });
  },

  async groups(): Promise<SalesGroup[]> {
    const res = await getAll<RawSalesGroup>('/sales-groups', { includeInactive: true });
    let groups = res.map(normalizeGroup);

    // If members array is empty, attempt to enrich from territory assignments
    if (groups.some((g) => g.members.length === 0)) {
      try {
        const assigns = await getAll<RawMembership>('/territory-assignments/sales', { includeInactive: false });
        if (Array.isArray(assigns) && assigns.length > 0) {
          assigns.forEach((a) => {
            if (a.userFullName && a.userId) staffNameToId.set(a.userFullName, a.userId);
          });
          groups = groups.map((g) => {
            const groupAssigns = assigns.filter(
              (a) =>
                a.salesGroupId === g.id ||
                a.salesGroupCode?.toUpperCase() === g.code.toUpperCase(),
            );
            if (groupAssigns.length > 0) {
              const members = groupAssigns.map((a) => a.userFullName || '—');
              return {
                ...g,
                members,
                memberRows: groupAssigns.map((a) => ({
                  userId: a.userId,
                  name: a.userFullName || '—',
                  groupCode: g.code,
                  revenueAfterPromo: 0,
                  revenueBeforePromo: 0,
                })),
              };
            }
            return g;
          });
        }
      } catch {
        // Territory assignments not accessible
      }
    }

    return groups;
  },

  async group(code: string): Promise<SalesGroup> {
    const target = await resolveGroupId(code);
    const res = await get<RawSalesGroup>(`/sales-groups/${target}`);
    return normalizeGroup(res);
  },

  async createGroup(v: GroupInput): Promise<SalesGroup> {
    const codeUpper = v.code.trim().toUpperCase();
    const regionId = await resolveRegionId(v.areaCode);
    // OpenAPI CreateSalesGroupRequest: regionId (uuid), code (string), name (string)
    const payload = {
      regionId: isUuid(regionId) ? regionId : undefined,
      code: codeUpper,
      name: codeUpper,
      ...(env.useMock
        ? {
            areaCode: v.areaCode,
            managerName: v.managerName,
            members: v.members,
          }
        : {}),
    };
    const res = await post<RawSalesGroup>('/sales-groups', payload);
    const created = normalizeGroup({ ...payload, ...res });

    // In real mode, assign each member to the newly created group
    if (!env.useMock && created.id && isUuid(created.id)) {
      for (const m of v.members) {
        try {
          const userId = staffNameToId.get(m);
          if (userId && isUuid(userId)) {
            await put(`/territory-assignments/sales/${userId}`, {
              destinationSalesGroupId: created.id,
            });
          }
        } catch {
          // Continue with next member
        }
      }
    }

    return created;
  },

  async updateGroup(v: GroupInput): Promise<SalesGroup> {
    const target = await resolveGroupId(v.code);
    // OpenAPI UpdateSalesGroupRequest: name (string)
    const payload = {
      name: v.code,
      ...(env.useMock
        ? {
            areaCode: v.areaCode,
            managerName: v.managerName,
            members: v.members,
          }
        : {}),
    };
    const res = await put<RawSalesGroup>(`/sales-groups/${target}`, payload);
    const updated = normalizeGroup({ ...payload, ...res, code: v.code, id: isUuid(target) ? target : res?.id });

    if (!env.useMock && isUuid(target)) {
      for (const m of v.members) {
        try {
          const userId = staffNameToId.get(m);
          if (userId && isUuid(userId)) {
            await put(`/territory-assignments/sales/${userId}`, {
              destinationSalesGroupId: target,
            });
          }
        } catch {
          // Continue
        }
      }
    }

    return updated;
  },

  async updateGroupStatus(idOrCode: string, isActive: boolean): Promise<void> {
    const target = await resolveGroupId(idOrCode);
    await patch(`/sales-groups/${target}/status`, { isActive });
  },

  async staff(): Promise<SalesStaff[]> {
    try {
      const assigns = await getAll<RawMembership>('/territory-assignments/sales', {
        includeInactive: false,
      });
      if (Array.isArray(assigns) && assigns.length > 0) {
        return assigns.map((a) => {
          if (a.userFullName && a.userId) staffNameToId.set(a.userFullName, a.userId);
          return {
            userId: a.userId,
            name: a.userFullName || '—',
            groupCode: a.salesGroupCode ?? null,
            groupId: a.salesGroupId ?? null,
            email: a.userEmail,
          };
        });
      }
    } catch {
      // Fallback to /sales-staff
    }
    return getAll<SalesStaff>('/sales-staff');
  },

  async managers(): Promise<{ id: string; name: string }[]> {
    try {
      const users = await getAll<{ id?: string; name?: string; role?: string; roles?: string[] }>('/users');
      const sms = users
        .filter((u) => {
          const role = u.role ?? (Array.isArray(u.roles) ? u.roles[0] : '');
          return role === 'SalesManager' || String(role).toLowerCase().includes('sales manager');
        })
        .map((u) => ({
          id: u.id ?? u.name ?? '',
          name: u.name ?? '',
        }));
      if (sms.length > 0) return sms;
    } catch {
      // Fallback
    }
    return [
      { id: 'Hồ Gia Bảo', name: 'Hồ Gia Bảo' },
    ];
  },

  retailersInGroup: (groupCode: string) =>
    getAll<GroupRetailerItem>('/retailers', { groupCode }),

  async transfer(v: TransferInput): Promise<{ name: string; fromGroup: string | null; toGroup: string; effectiveDate?: string }> {
    // If we have resolved user UUID and destination sales group UUID, use OpenAPI PUT /territory-assignments/sales/{userId}
    const userId = staffNameToId.get(v.name);
    const destGroupId = await resolveGroupId(v.toGroup);

    if (userId && isUuid(userId) && isUuid(destGroupId)) {
      try {
        await put(`/territory-assignments/sales/${userId}`, {
          destinationSalesGroupId: destGroupId,
        });
        return {
          name: v.name,
          fromGroup: null,
          toGroup: v.toGroup,
          effectiveDate: v.effectiveDate,
        };
      } catch {
        // Fallback to POST /sales-staff/transfer
      }
    }

    return post<{ name: string; fromGroup: string | null; toGroup: string; effectiveDate?: string }>(
      '/sales-staff/transfer',
      v,
    );
  },
};
