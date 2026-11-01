/** Runtime configuration read from Vite env vars (see .env.example). */
export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  },
} as const;
