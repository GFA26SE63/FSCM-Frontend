/**
 * Dịch vụ vị trí VietMap (Services API – khóa VITE_VIETMAP_SEARCH_API_KEY):
 *  - forwardGeocode: địa chỉ → tọa độ  (Search v4 → Place v4). Chỉ gọi khi người dùng bấm "Định vị".
 *  - reverseGeocode: tọa độ → địa chỉ (Reverse v4). Gọi khi người dùng chọn điểm trên bản đồ.
 *
 * Không có dữ liệu dự phòng: khi dịch vụ không trả kết quả thì trả về rỗng/null,
 * khi dịch vụ lỗi thì ném lỗi để giao diện giữ nguyên dữ liệu người dùng đã nhập.
 * Kết quả giống nhau được dùng lại để tránh gọi trùng.
 */

import { env } from './env';

const SERVICE_BASE = 'https://maps.vietmap.vn/api';
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_LIMIT = 100;
/** Độ chính xác tọa độ dùng trong toàn bộ Portal (≈ 11 m). */
const COORD_DECIMALS = 4;

export class GeocodingError extends Error {
  constructor(message = 'Dịch vụ định vị tạm thời không khả dụng.') {
    super(message);
    this.name = 'GeocodingError';
  }
}

export function roundCoord(value: number): number {
  const f = 10 ** COORD_DECIMALS;
  return Math.round(value * f) / f;
}

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  const la = Number(lat);
  const ln = Number(lng);
  return (
    lat !== null && lat !== undefined && lat !== '' &&
    lng !== null && lng !== undefined && lng !== '' &&
    Number.isFinite(la) && Number.isFinite(ln) &&
    !(la === 0 && ln === 0) &&
    Math.abs(la) <= 90 && Math.abs(ln) <= 180
  );
}

const cache = new Map<string, Promise<unknown>>();

/** Gộp các yêu cầu giống nhau (đang chạy hoặc đã thành công); lỗi thì không lưu để có thể thử lại. */
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;
  const promise = load().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, promise);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return promise;
}

async function callService(path: string, params: Record<string, string>): Promise<unknown> {
  const key = env.vietmap.searchKey;
  if (!key) throw new GeocodingError();
  const query = new URLSearchParams({ apikey: key, ...params });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVICE_BASE}/${path}?${query.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new GeocodingError();
    return (await res.json()) as unknown;
  } catch (err) {
    if (err instanceof GeocodingError) throw err;
    throw new GeocodingError();
  } finally {
    clearTimeout(timer);
  }
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Tọa độ → địa chỉ. Trả về '' khi VietMap không có địa chỉ tại điểm này.
 * @throws GeocodingError khi dịch vụ lỗi / chưa cấu hình.
 */
export function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (!isValidCoordinate(lat, lng)) return Promise.resolve('');
  const la = roundCoord(Number(lat));
  const ln = roundCoord(Number(lng));
  return cached(`reverse:${la},${ln}`, async () => {
    const data = await callService('reverse/v4', { lat: String(la), lng: String(ln) });
    const first = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    return text(first?.display) || text(first?.address) || text(first?.name);
  });
}

/**
 * Địa chỉ → tọa độ của kết quả phù hợp nhất. Trả về null khi không tìm thấy.
 * @throws GeocodingError khi dịch vụ lỗi / chưa cấu hình.
 */
export function forwardGeocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const q = address.trim();
  if (!q) return Promise.resolve(null);
  return cached(`forward:${q.toLowerCase()}`, async () => {
    const results = await callService('search/v4', { text: q });
    const refId = Array.isArray(results) ? text((results[0] as Record<string, unknown> | undefined)?.ref_id) : '';
    if (!refId) return null;
    const place = (await callService('place/v4', { refid: refId })) as Record<string, unknown> | null;
    const lat = Number(place?.lat);
    const lng = Number(place?.lng);
    if (!isValidCoordinate(lat, lng)) return null;
    return { lat: roundCoord(lat), lng: roundCoord(lng) };
  });
}

/**
 * Chỉ chấp nhận kết quả của yêu cầu mới nhất: phản hồi chậm của lần chọn trước
 * không được ghi đè lựa chọn mới hơn.
 */
export function createLatestGuard() {
  let current = 0;
  return {
    next(): number {
      current += 1;
      return current;
    },
    isLatest(id: number): boolean {
      return id === current;
    },
  };
}
