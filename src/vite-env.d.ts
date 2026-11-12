/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** VietMap Maps API key – Street Map tiles. */
  readonly VITE_VIETMAP_MAPS_API_KEY?: string;
  /** VietMap Services API key – search, place, reverse geocoding. */
  readonly VITE_VIETMAP_SEARCH_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
