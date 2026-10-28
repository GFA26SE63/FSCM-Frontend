import { graphql } from '@/shared/api/graphql';
import { ApiError } from '@/shared/api/errors';
import { http, post, put } from '@/shared/api/http';
import type {
  CreatedUser,
  CreateUserInput,
  ScopeConnection,
  ScopeKind,
  ScopeOption,
  UpdateUserInput,
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

export const userApi = {
  async list(filters: UserFilters): Promise<UserPage> {
    const result = await graphql<{ users: UserPage }>(
      USERS_QUERY,
      {
        search: filters.search.trim() || null,
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

    return result.options;
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

  return result;
}