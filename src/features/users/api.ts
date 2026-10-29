import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import { get, getAll, http, post, put } from '@/shared/api/http';
import type {
  CreatedUser,
  CreateUserInput,
  ScopeConnection,
  ScopeKind,
  ScopeOption,
  UpdateUserInput,
  User,
  UserDetail,
  UserFilters,
  UserPage,
} from './types';

const USERS_QUERY = `
  query Users(
    $search: String
    $role: String
    $isActive: Boolean
    $page: Int!
    $pageSize: Int!
  ) {
    users(
      search: $search
      role: $role
      isActive: $isActive
      page: $page
      pageSize: $pageSize
    ) {
      items {
        id
        email
        fullName
        role
        isActive
        identityProvider
        createdAt
        updatedAt
      }
      page
      pageSize
      totalCount
    }
  }
`;

const USER_QUERY = `
  query User($id: UUID!) {
    user(id: $id) {
      id
      email
      fullName
      role
      mustChangePassword
      scope {
        warehouseIds
        regionIds
        salesGroupIds
        retailerIds
      }
    }
  }
`;

const scopeListRoots: Record<ScopeKind, string> = {
  warehouses: 'warehouses(includeInactive: false,',
  regions: 'regions(includeInactive: false,',
  'sales-groups': 'salesGroups(includeInactive: false,',
  retailers: 'retailers(status: "Active",',
};

const scopeDetailRoots: Record<ScopeKind, string> = {
  warehouses: 'warehouse',
  regions: 'region',
  'sales-groups': 'salesGroup',
  retailers: 'retailer',
};

function normalizeUser(u: any): User {
  return {
    id: String(u.id ?? u.userId ?? ''),
    email: String(u.email ?? u.loginName ?? ''),
    fullName: String(u.fullName ?? u.name ?? u.email ?? ''),
    role: u.role,
    isActive: typeof u.isActive === 'boolean' ? u.isActive : u.status === 'Active',
    identityProvider: u.identityProvider ?? 'Local',
    createdAt: u.createdAt ?? new Date().toISOString(),
    updatedAt: u.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeUserPage(raw: any, filters: UserFilters): UserPage {
  if (Array.isArray(raw)) {
    return {
      items: raw.map(normalizeUser),
      page: filters.page,
      pageSize: filters.pageSize,
      totalCount: raw.length,
    };
  }
  const items = Array.isArray(raw?.items) ? raw.items.map(normalizeUser) : [];
  return {
    items,
    page: Number(raw?.page) || filters.page,
    pageSize: Number(raw?.pageSize ?? raw?.size) || filters.pageSize,
    totalCount: Number(raw?.totalCount ?? raw?.total) || items.length,
  };
}

export const userApi = {
  async list(filters: UserFilters): Promise<UserPage> {
    const params: Record<string, string | number | boolean> = {
      page: filters.page,
      pageSize: filters.pageSize,
    };
    const s = filters.search.trim();
    if (s) params.search = s;
    if (filters.role) params.role = filters.role;
    if (filters.activity === 'active') params.isActive = true;
    if (filters.activity === 'inactive') params.isActive = false;

    // 1. Try REST API GET /api/v1/users (official OpenAPI 3.0 contract in apiv1.json)
    try {
      const res = await get<any>('/users', params);
      if (res) {
        return normalizeUserPage(res, filters);
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        throw err;
      }
    }

    // 2. Fallback to GraphQL if backend serves users via HotChocolate gateway
    const result = await graphql<{ users: UserPage }>(
      USERS_QUERY,
      {
        search: s || null,
        role: filters.role || null,
        isActive:
          filters.activity === ''
            ? null
            : filters.activity === 'active',
        page: filters.page,
        pageSize: filters.pageSize,
      },
    );

    return result.users;
  },

  async get(id: string): Promise<UserDetail> {
    // 1. Try REST API GET /api/v1/users/{userId}
    try {
      const u = await get<any>(`/users/${encodeURIComponent(id)}`);
      if (u) {
        return {
          id: String(u.id ?? id),
          email: String(u.email ?? u.loginName ?? ''),
          fullName: String(u.fullName ?? u.name ?? u.email ?? ''),
          role: u.role,
          mustChangePassword: !!u.mustChangePassword,
          scope: {
            warehouseIds: Array.isArray(u.scope?.warehouseIds) ? u.scope.warehouseIds : [],
            regionIds: Array.isArray(u.scope?.regionIds) ? u.scope.regionIds : [],
            salesGroupIds: Array.isArray(u.scope?.salesGroupIds) ? u.scope.salesGroupIds : [],
            retailerIds: Array.isArray(u.scope?.retailerIds) ? u.scope.retailerIds : [],
          },
        };
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        throw err;
      }
    }

    // 2. Fallback to GraphQL USER_QUERY
    const result = await graphql<{ user: UserDetail | null }>(
      USER_QUERY,
      { id },
    );

    if (!result.user) {
      throw new ApiError(404, 'Không tìm thấy tài khoản.');
    }

    return result.user;
  },

  create: (input: CreateUserInput) =>
    post<CreatedUser>('/users', input),

  update: ({ id, ...input }: UpdateUserInput) =>
    put<UserDetail>(
      `/users/${encodeURIComponent(id)}`,
      input,
    ),

  async setStatus(input: { id: string; isActive: boolean }) {
    await http.patch(
      `/users/${encodeURIComponent(input.id)}/status`,
      { isActive: input.isActive },
    );
  },

  async scopeOptions(
    kind: ScopeKind,
    search: string,
    after: string | null,
  ): Promise<ScopeConnection> {
    // 1. Try GraphQL if available
    try {
      const query = `
        query ScopeOptions($search: String!, $after: String) {
          options: ${scopeListRoots[kind]}
            first: 20
            after: $after
            where: {
              or: [
                { name: { contains: $search } }
                { code: { contains: $search } }
              ]
            }
          ) {
            nodes {
              id
              code
              name
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      `;

      const result = await graphql<{
        options: ScopeConnection;
      }>(query, {
        search: search.trim(),
        after,
      });

      if (result?.options) {
        return result.options;
      }
    } catch {
      // Fallback to REST endpoints
    }

    // 2. Fallback to REST: /warehouses, /regions, /sales-groups, /retailers
    const endpointMap: Record<ScopeKind, string> = {
      warehouses: '/warehouses',
      regions: '/regions',
      'sales-groups': '/sales-groups',
      retailers: '/retailers',
    };

    try {
      const rawList = await getAll<any>(endpointMap[kind]);
      const s = search.trim().toLowerCase();
      const filtered = rawList.filter((item: any) => {
        const code = String(item.code ?? item.retailerCode ?? '').toLowerCase();
        const name = String(item.name ?? item.retailerName ?? '').toLowerCase();
        return !s || code.includes(s) || name.includes(s);
      });

      return {
        nodes: filtered.slice(0, 50).map((x: any) => ({
          id: String(x.id ?? x.code ?? ''),
          code: String(x.code ?? x.retailerCode ?? ''),
          name: String(x.name ?? x.retailerName ?? ''),
        })),
        pageInfo: {
          endCursor: null,
          hasNextPage: false,
        },
      };
    } catch {
      return {
        nodes: [],
        pageInfo: {
          endCursor: null,
          hasNextPage: false,
        },
      };
    }
  },

  async changeScope(input: {
    userId: string;
    kind: ScopeKind;
    scopeId: string;
    remove: boolean;
  }) {
    const path =
      `/users/${encodeURIComponent(input.userId)}` +
      `/scope/${input.kind}/${encodeURIComponent(input.scopeId)}`;

    if (input.remove) {
      await http.delete(path);
    } else {
      await http.put(path);
    }
  },
};

export async function getAssignmentNames(
  kind: ScopeKind,
  ids: string[],
): Promise<ScopeOption[]> {
  if (ids.length === 0) return [];

  const root = scopeDetailRoots[kind];
  const result: ScopeOption[] = [];

  // 1. Try GraphQL first
  try {
    for (let offset = 0; offset < ids.length; offset += 20) {
      const batch = ids.slice(offset, offset + 20);

      const definitions = batch
        .map((_, index) => `$id${index}: UUID!`)
        .join(', ');

      const fields = batch
        .map(
          (_, index) => `
            item${index}: ${root}(id: $id${index}) {
              id
              code
              name
            }
          `,
        )
        .join('\n');

      const variables = Object.fromEntries(
        batch.map((id, index) => [`id${index}`, id]),
      );

      const data = await graphql<
        Record<string, ScopeOption | null>
      >(
        `query AssignmentNames(${definitions}) {
          ${fields}
        }`,
        variables,
      );

      for (const item of Object.values(data)) {
        if (item) result.push(item);
      }
    }
    if (result.length > 0) return result;
  } catch {
    // Fallback to REST
  }

  // 2. Fallback to REST endpoints
  const endpointMap: Record<ScopeKind, string> = {
    warehouses: '/warehouses',
    regions: '/regions',
    'sales-groups': '/sales-groups',
    retailers: '/retailers',
  };

  try {
    const all = await getAll<any>(endpointMap[kind]);
    for (const id of ids) {
      const matched = all.find((x: any) => x.id === id || x.code === id);
      if (matched) {
        result.push({
          id: String(matched.id ?? matched.code ?? ''),
          code: String(matched.code ?? matched.retailerCode ?? ''),
          name: String(matched.name ?? matched.retailerName ?? ''),
        });
      }
    }
  } catch {
    // Ignore error
  }

  return result;
}
