/** Runtime configuration read from Vite env vars (see .env.example). */
export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
  entra: {
    tenantId: import.meta.env.VITE_ENTRA_TENANT_ID ?? '',
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID ?? '',
    redirectUri: import.meta.env.VITE_ENTRA_REDIRECT_URI ?? `${window.location.origin}/login`,
  },
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  },
} as const;
