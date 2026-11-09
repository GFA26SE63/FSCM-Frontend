import { getAll, post, put } from '@/shared/api/http';
import type { Area, AreaInput, GroupInput, SalesGroup, SalesStaff, TransferInput } from './types';

interface ApiRegion { id: string; code: string; name: string; description?: string; isActive: boolean }
interface ApiGroup { id: string; regionId: string; regionCode: string; regionName: string; code: string; name: string; isActive: boolean }
interface ApiMembership { salesGroupId: string; salesGroupCode: string; userId: string; userFullName: string; isActive: boolean }
interface ApiRetailerAssignment { salesGroupId: string; isActive: boolean }

const regions = () => getAll<ApiRegion>('/regions', { includeInactive: true });
const groups = () => getAll<ApiGroup>('/sales-groups', { includeInactive: true });
const memberships = () => getAll<ApiMembership>('/territory-assignments/sales', { includeInactive: true });
const retailerAssignments = () => getAll<ApiRetailerAssignment>('/territory-assignments/retailers', { includeInactive: true });

async function groupRows(): Promise<SalesGroup[]> {
  const [rows, members, retailerRows] = await Promise.all([groups(), memberships(), retailerAssignments()]);
  return rows.map((row) => {
    const activeMembers = members.filter((m) => m.salesGroupId === row.id && m.isActive);
    return {
      id: row.id,
      code: row.code,
      areaCode: row.regionCode,
      areaName: row.regionName,
      managerName: '—',
      members: activeMembers.map((m) => m.userFullName),
      retailerCount: retailerRows.filter((r) => r.salesGroupId === row.id && r.isActive).length,
      memberRows: activeMembers.map((m) => ({ name: m.userFullName, groupCode: row.code, revenueAfterPromo: 0, revenueBeforePromo: 0 })),
    };
  });
}

export const regionApi = {
  areas: async (): Promise<Area[]> => {
    const [areaRows, groupList, assignments] = await Promise.all([regions(), groups(), retailerAssignments()]);
    return areaRows.map((row) => {
      const areaGroups = groupList.filter((g) => g.regionId === row.id);
      const groupIds = new Set(areaGroups.map((g) => g.id));
      return { id: row.id, code: row.code, name: row.name, region: row.description ?? '', managerName: '—', wards: [], groups: areaGroups.map((g) => g.code), retailerCount: assignments.filter((a) => a.isActive && groupIds.has(a.salesGroupId)).length };
    });
  },
  createArea: (v: AreaInput) => post<ApiRegion>('/regions', { code: v.code, name: v.name, description: v.region }),
  groups: groupRows,
  group: async (code: string) => {
    const row = (await groupRows()).find((g) => g.code === code);
    if (!row) throw new Error(`Không tìm thấy nhóm ${code}.`);
    return row;
  },
  createGroup: async (v: GroupInput) => {
    const region = (await regions()).find((r) => r.code === v.areaCode);
    if (!region) throw new Error('Khu vực không hợp lệ.');
    return post<ApiGroup>('/sales-groups', { regionId: region.id, code: v.code, name: v.code });
  },
  updateGroup: async (v: GroupInput) => {
    const group = (await groups()).find((g) => g.code === v.code);
    if (!group) throw new Error(`Không tìm thấy nhóm ${v.code}.`);
    return put<ApiGroup>(`/sales-groups/${group.id}`, { name: group.name });
  },
  staff: async (): Promise<SalesStaff[]> => (await memberships()).filter((m) => m.isActive).map((m) => ({ userId: m.userId, name: m.userFullName, groupCode: m.salesGroupCode })),
  transfer: async (v: TransferInput) => {
    const [staff, groupList] = await Promise.all([memberships(), groups()]);
    const person = staff.find((s) => s.userFullName === v.name && s.isActive);
    const destination = groupList.find((g) => g.code === v.toGroup);
    if (!person || !destination) throw new Error('Sales hoặc nhóm đích không hợp lệ.');
    const result = await put<ApiMembership>(`/territory-assignments/sales/${person.userId}`, { destinationSalesGroupId: destination.id });
    return { name: result.userFullName, fromGroup: person.salesGroupCode, toGroup: result.salesGroupCode };
  },
};
