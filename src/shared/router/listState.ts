import { useCallback, useMemo } from 'react';
import { useHistory, useLocation } from 'react-router-dom';

/**
 * Trạng thái màn hình danh sách (tìm kiếm, bộ lọc, trang, sắp xếp, tab) được lưu trên
 * query string của URL – nguồn dữ liệu duy nhất. Nhờ vậy trạng thái còn nguyên khi:
 *   - mở chi tiết rồi quay lại (nút Quay lại / breadcrumb / Back của trình duyệt),
 *   - tải lại trang, Back/Forward, mở link trong tab mới.
 *
 * Mọi thay đổi bộ lọc dùng history.replace để không tạo thêm bước trong lịch sử.
 */

export type ParamValue = string | number | null | undefined;
export type ParamUpdates = Record<string, ParamValue>;

/** Location state đánh dấu điều hướng "quay về danh sách" → khôi phục vị trí cuộn. */
export const RETURN_TO_LIST_STATE = { fscmReturnToList: true } as const;

export function isReturnToListState(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as Record<string, unknown>).fscmReturnToList === true;
}

/** Tên tham số theo namespace của từng bảng (vd. "drivers.q"); không namespace → giữ nguyên. */
export function paramName(namespace: string | undefined, key: string): string {
  return namespace ? `${namespace}.${key}` : key;
}

function toSearch(params: URLSearchParams): string {
  const s = params.toString();
  return s ? `?${s}` : '';
}

function normalizeSearch(search: string): string {
  return search === '?' ? '' : search;
}

/**
 * location hiện tại, hoặc null khi component được render ngoài Router (vd. fixture kiểm thử).
 * useLocation của react-router v5 luôn gọi useContext rồi mới đọc .location, nên thứ tự hook không đổi.
 */
function useOptionalLocation() {
  try {
    return useLocation();
  } catch {
    return null;
  }
}

/** Đọc/ghi query params của route hiện tại. hasRouter = false → không có URL để lưu trạng thái. */
export function useQueryParams() {
  const location = useOptionalLocation();
  const history = useHistory() as ReturnType<typeof useHistory> | undefined;
  const search = location?.search ?? '';
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const pathname = location?.pathname ?? '';

  const setParams = useCallback(
    (updates: ParamUpdates) => {
      if (!history) return;
      // Đọc location "sống" để nhiều cập nhật liên tiếp không ghi đè lẫn nhau.
      const current = history.location;
      // Bỏ qua cập nhật trễ (vd. sau khi lưu xong) nếu người dùng đã rời màn hình.
      if (current.pathname !== pathname) return;
      const next = new URLSearchParams(current.search);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      const search = toSearch(next);
      if (search === normalizeSearch(current.search)) return;
      history.replace({ pathname: current.pathname, search, hash: current.hash, state: current.state });
    },
    [history, pathname],
  );

  return { params, setParams, hasRouter: location !== null && !!history };
}

interface ParamOptions {
  /** Các tham số bị xóa cùng lúc khi giá trị đổi (thường là trang hiện tại). */
  resets?: string[];
}

function resetUpdates(resets: string[] | undefined): ParamUpdates {
  return Object.fromEntries((resets ?? []).map((k) => [k, null]));
}

/** Tham số chuỗi tự do (từ khóa, id…). Chuỗi rỗng = bỏ khỏi URL. */
export function useStringParam(name: string, options: ParamOptions = {}): [string, (value: string) => void] {
  const { params, setParams } = useQueryParams();
  const value = params.get(name) ?? '';
  const resets = options.resets?.join('|');
  const set = useCallback(
    (next: string) => setParams({ ...resetUpdates(resets ? resets.split('|') : undefined), [name]: next }),
    [setParams, name, resets],
  );
  return [value, set];
}

/** Tham số thuộc tập giá trị cho trước; giá trị lạ trên URL → fallback. Giá trị mặc định không ghi lên URL. */
export function useEnumParam<K extends string>(
  name: string,
  allowed: readonly K[],
  fallback: K,
  options: ParamOptions = {},
): [K, (value: K) => void] {
  const [raw, setRaw] = useStringParam(name, options);
  const value = (allowed as readonly string[]).includes(raw) ? (raw as K) : fallback;
  const set = useCallback((next: K) => setRaw(next === fallback ? '' : next), [setRaw, fallback]);
  return [value, set];
}

/** yyyy-MM-dd hợp lệ (ngày có thật). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Ngày yyyy-MM-dd; giá trị không hợp lệ trên URL bị bỏ qua (''). */
export function useDateParam(name: string, options: ParamOptions = {}): [string, (value: string) => void] {
  const [raw, setRaw] = useStringParam(name, options);
  return [isIsoDate(raw) ? raw : '', setRaw];
}

const MAX_PAGE = 100_000;

/** Số trang dương; giá trị lạ → 1. Trang 1 không ghi lên URL. */
export function parsePage(raw: string | null): number {
  if (!raw || !/^\d{1,6}$/.test(raw)) return 1;
  const n = Number(raw);
  return n >= 1 && n <= MAX_PAGE ? n : 1;
}

/* ------------------------------------------------------------------ */
/* Ghi nhớ URL danh sách gần nhất để "Quay lại" về đúng trạng thái.     */
/* ------------------------------------------------------------------ */

const MEMORY_KEY = 'fscm.listLocations.v1';
const MEMORY_LIMIT = 60;

type ListMemory = Record<string, string>;

function readMemory(): ListMemory {
  try {
    const raw = sessionStorage.getItem(MEMORY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (e): e is [string, string] => typeof e[1] === 'string' && e[1].startsWith('?'),
      ),
    );
  } catch {
    return {};
  }
}

function writeMemory(memory: ListMemory) {
  try {
    sessionStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    /* sessionStorage không khả dụng: quay lại route gốc. */
  }
}

/** Ghi nhận query string hiện tại của một đường dẫn (gọi từ layout mỗi khi URL đổi). */
export function rememberLocation(pathname: string, search: string) {
  const memory = readMemory();
  const normalized = normalizeSearch(search);
  if ((memory[pathname] ?? '') === normalized) return;
  delete memory[pathname];
  if (normalized) memory[pathname] = normalized;
  const keys = Object.keys(memory);
  for (const k of keys.slice(0, Math.max(0, keys.length - MEMORY_LIMIT))) delete memory[k];
  writeMemory(memory);
}

/** Xóa toàn bộ trạng thái danh sách đã ghi nhớ (vd. khi đăng xuất). */
export function clearRememberedLocations() {
  try {
    sessionStorage.removeItem(MEMORY_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * URL quay lại danh sách: đường dẫn kèm query string lần cuối người dùng xem trong tab này.
 * Đường dẫn đã có query string hoặc chưa từng được ghi nhớ → trả về nguyên trạng (route gốc).
 */
export function listHref(path: string): string {
  if (path.includes('?') || path.includes('#')) return path;
  return path + (readMemory()[path] ?? '');
}

/** navigate tới danh sách và khôi phục bộ lọc + vị trí cuộn. */
export function useReturnToList() {
  const history = useHistory();
  return useCallback(
    (path: string) => {
      const href = listHref(path);
      const [pathname, search = ''] = href.split('?');
      history.push({ pathname, search: search ? `?${search}` : '', state: RETURN_TO_LIST_STATE });
    },
    [history],
  );
}
