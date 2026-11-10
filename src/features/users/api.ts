import { ApiError } from '@/shared/api/errors';
import { get, http, post, put } from '@/shared/api/http';
import { graphql } from '@/shared/api/graphql';
import type {
  CreatedUser,
  CreateUserInput,
  IdentityProvider,
  ScopeConnection,
  ScopeKind,
  ScopeOption,
  UpdateUserInput,
  User,
  UserDetail,
  UserFilters,
  UserPage,
  UserRole,
  UserAuditPage,
} from './types';
import { assertCreatableRole } from './userPolicy';

const scopePageSize = 20;

// Only request history metadata. Raw old/new JSON can contain contact details
// or authentication data and must not enter the table or its query cache.
const userAuditQuery = `
  query UserAuditHistory($userId: UUID!, $after: String) {
    entities {
      auditLogs(
        first: 20
        after: $after
        where: { entityName: { eq: "UserAccount" }, entityId: { eq: $userId } }
        order: [{ createdAt: DESC }, { id: DESC }]
      ) {
        nodes { id userAccountId action reason createdAt }
        pageInfo { endCursor hasNextPage }
      }
    }
  }
`;

interface RetailerOptionsPage {
  items: ScopeOption[];
  totalCount: number;
}

interface RawUserItem {
  id?: string;
  userId?: string;
  email?: string;
  phone?: string;
  loginName?: string;
  fullName?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  status?: string;
  identityProvider?: IdentityProvider;
  createdAt?: string;
  updatedAt?: string;
}

interface RawUserPage {
  items?: RawUserItem[];
  page?: number;
  pageSize?: number;
  size?: number;
  totalCount?: number;
  total?: number;
}

function normalizeUser(u: RawUserItem): User {
  return {
    id: String(u.id ?? u.userId ?? ''),
    email: String(u.email ?? u.loginName ?? ''),
    phone: String(u.phone ?? ''),
    fullName: String(u.fullName ?? u.name ?? u.email ?? ''),
    role: (u.role ?? 'Sales') as UserRole,
    isActive: typeof u.isActive === 'boolean' ? u.isActive : u.status === 'Active',
    identityProvider: (u.identityProvider ?? 'Local') as IdentityProvider,
    createdAt: u.createdAt ?? new Date().toISOString(),
    updatedAt: u.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeUserPage(raw: RawUserPage | RawUserItem[] | null | undefined, filters: UserFilters): UserPage {
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
  list: async (filters: UserFilters): Promise<UserPage> => {
    const raw = await get<RawUserPage | RawUserItem[]>('/users', {
      search: filters.search.trim() || undefined,
      role: filters.role || undefined,
      isActive:
        filters.activity === ''
          ? undefined
          : filters.activity === 'active',
      page: filters.page,
      pageSize: filters.pageSize,
    });
    return normalizeUserPage(raw, filters);
  },

  get: (id: string): Promise<UserDetail> =>
    get<UserDetail>(`/users/${encodeURIComponent(id)}`),

  audit: async (userId: string, after: string | null): Promise<UserAuditPage> => {
    const data = await graphql<{ entities: { auditLogs: UserAuditPage } }>(
      userAuditQuery, { userId, after },
    );
    const page = data.entities?.auditLogs;
    if (!page || !Array.isArray(page.nodes) || !page.pageInfo ||
        typeof page.pageInfo.hasNextPage !== 'boolean' ||
        (page.pageInfo.hasNextPage && !page.pageInfo.endCursor)) {
      throw new ApiError(502, 'Phản hồi lịch sử tài khoản không hợp lệ.');
    }
    return page;
  },

  async create(
    input: CreateUserInput,
  ): Promise<CreatedUser> {
    assertCreatableRole(input.role);

    return post<CreatedUser>('/users', {
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      phone: input.phone,
      password: input.password,
    });
  },

  update: ({
    id,
    email,
    fullName,
  }: UpdateUserInput) =>
    put<UserDetail>(
      `/users/${encodeURIComponent(id)}`,
      {
        email,
        fullName,
      },
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
    // AssignmentPicker accepts an opaque cursor; REST uses page numbers.
    const page = after === null ? 1 : Number(after);
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new ApiError(400, 'Trang phân quyền không hợp lệ.');
    }

    let nodes: ScopeOption[];
    let hasNextPage: boolean;

    if (kind === 'retailers') {
      const result = await get<RetailerOptionsPage>('/retailers', {
        status: 'Active',
        search: search.trim() || undefined,
        page,
        pageSize: scopePageSize,
      });
      nodes = result.items;
      hasNextPage = page * scopePageSize < result.totalCount;
    } else {
      // These three REST endpoints return unpaged active collections.
      const result = await get<ScopeOption[]>(`/${kind}`, {
        includeInactive: false,
      });
      const term = search.trim().toLocaleLowerCase('vi-VN');
      const matching = result.filter((item) =>
        !term ||
        item.name.toLocaleLowerCase('vi-VN').includes(term) ||
        item.code.toLocaleLowerCase('vi-VN').includes(term),
      );
      const offset = (page - 1) * scopePageSize;
      nodes = matching.slice(offset, offset + scopePageSize);
      hasNextPage = offset + scopePageSize < matching.length;
    }

    return {
      nodes,
      pageInfo: {
        endCursor: hasNextPage ? String(page + 1) : null,
        hasNextPage,
      },
    };
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
  const result: ScopeOption[] = [];

  for (let offset = 0; offset < ids.length; offset += 20) {
    const batch = ids.slice(offset, offset + 20);
    const items = await Promise.all(
      batch.map((id) =>
        get<ScopeOption>(`/${kind}/${encodeURIComponent(id)}`),
      ),
    );
    result.push(...items);
  }

  return result;
}
