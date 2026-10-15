/** Paging contract of every list endpoint: ?page=&size=&search= (SPEC §8). page is 1-based. */
export interface PageQuery {
  page?: number;
  size?: number;
  search?: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

/** RFC 7807 ProblemDetails as returned by ASP.NET Core (FSCM.Api). */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  code?: string;
  errors?: Record<string, string[]>;
  traceId?: string;
}
