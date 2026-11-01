import { ApiError } from '@/shared/api/errors';
import { get } from '@/shared/api/http';
import type { CurrentUser } from '@/shared/auth/authApi';
import type { Area, SalesGroup, SalesStaff } from './types';

interface GroupRecord {
  id: string;
  regionId: string;
  regionCode: string;
  regionName: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface RegionRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface Membership {
  userId: string;
  userFullName: string;
  userEmail: string;
  salesGroupId: string;
  salesGroupCode: string;
  isActive: boolean;
}

interface RetailerAssignment {
  retailerId: string;
  salesGroupId: string;
  isActive: boolean;
}

export interface ManagerTerritory {
  areas: Area[];
  groups: SalesGroup[];
  staff: SalesStaff[];
}

/** Use scoped assignment APIs; /users is an Admin-only directory. */
export async function loadManagerTerritory(user: CurrentUser): Promise<ManagerTerritory> {
  if (user.role !== 'SalesManager') {
    throw new ApiError(403, 'Chỉ Sales Manager được dùng luồng này.');
  }
  const ids = user.scope?.salesGroupIds ?? [];
  if (ids.length === 0) return { areas: [], groups: [], staff: [] };

  const [allGroups, allRegions] = await Promise.all([
    get<GroupRecord[]>('/sales-groups'),
    get<RegionRecord[]>('/regions'),
  ]);
  const allowedGroups = allGroups.filter((g) => g.isActive && ids.includes(g.id));
  const details = await Promise.all(allowedGroups.map(async (group) => {
    const params = { salesGroupId: group.id, includeInactive: false };
    // Do not swallow 401/403: revoked assignments must be visible to the user.
    const [members, retailers] = await Promise.all([
      get<Membership[]>('/territory-assignments/sales', params),
      get<RetailerAssignment[]>('/territory-assignments/retailers', params),
    ]);
    return { group, members: members.filter((m) => m.isActive), retailers: retailers.filter((r) => r.isActive) };
  }));

  const groups: SalesGroup[] = details.map(({ group: g, members, retailers }) => ({
    id: g.id, regionId: g.regionId, code: g.code, name: g.name,
    areaCode: g.regionCode, areaName: g.regionName,
    managerId: user.id, managerName: user.name,
    members: members.map((m) => m.userFullName || m.userEmail),
    memberRows: members.map((m) => ({
      userId: m.userId, name: m.userFullName || m.userEmail, groupCode: g.code,
    })),
    retailerCount: new Set(retailers.map((r) => r.retailerId)).size,
    isActive: g.isActive,
  }));
  const staff = [...new Map(details.flatMap(({ group, members }) => members.map((m) => [m.userId, {
    userId: m.userId, name: m.userFullName || m.userEmail, email: m.userEmail,
    groupCode: group.code, groupId: group.id,
  }] as const))).values()];
  const areas: Area[] = allRegions
    .filter((r) => groups.some((g) => g.regionId === r.id))
    .map((r) => ({
      id: r.id, code: r.code, name: r.name, description: r.description ?? '',
      managerId: user.id, managerName: user.name,
      groups: groups.filter((g) => g.regionId === r.id).map((g) => g.code),
      retailerCount: new Set(details.filter((d) => d.group.regionId === r.id)
        .flatMap((d) => d.retailers.map((a) => a.retailerId))).size,
      isActive: r.isActive,
    }));
  return { areas, groups, staff };
}

export function requireManagedGroup(territory: ManagerTerritory, idOrCode: string): SalesGroup {
  const group = territory.groups.find((g) => g.id === idOrCode || g.code === idOrCode);
  if (!group) throw new ApiError(403, 'Nhóm Sales nằm ngoài phạm vi được phân công.');
  return group;
}
