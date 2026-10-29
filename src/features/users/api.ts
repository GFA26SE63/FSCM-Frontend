import { ApiError } from '@/shared/api/errors';
import { get, http, post, put } from '@/shared/api/http';
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

const scopePageSize = 20;

interface RetailerOptionsPage {
  items: ScopeOption[];
  totalCount: number;
}

export const userApi = {
  list: (filters: UserFilters): Promise<UserPage> =>
    get<UserPage>('/users', {
      search: filters.search.trim() || undefined,
      role: filters.role || undefined,
      isActive:
        filters.activity === ''
          ? undefined
          : filters.activity === 'active',
      page: filters.page,
      pageSize: filters.pageSize,
    }),

  get: (id: string): Promise<UserDetail> =>
    get<UserDetail>(`/users/${encodeURIComponent(id)}`),

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
