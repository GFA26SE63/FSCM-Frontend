/** Runtime configuration read from Vite env vars (see .env.example). */
export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  },
  /**
   * VietMap dùng hai khóa trình duyệt riêng biệt (không dùng thay thế cho nhau):
   *  - mapsKey: Maps API – ô bản đồ nền Street Map (raster "tm").
   *  - searchKey: Services API – tìm kiếm địa chỉ, chi tiết địa điểm, định vị ngược.
   */
  vietmap: {
    mapsKey: (import.meta.env.VITE_VIETMAP_MAPS_API_KEY ?? '').trim(),
    searchKey: (import.meta.env.VITE_VIETMAP_SEARCH_API_KEY ?? '').trim(),
  },
} as const;
