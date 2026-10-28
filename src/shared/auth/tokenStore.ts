const ACCESS_KEY = 'fscm.portal.token';
const REFRESH_KEY = 'fscm.portal.refresh-token';

let unauthorizedHandler: (() => void) | null = null;

export const tokenStore = {
  get(): string | null {
    return sessionStorage.getItem(ACCESS_KEY);
  },

  getRefreshToken(): string | null {
    return sessionStorage.getItem(REFRESH_KEY);
  },

  set(accessToken: string, refreshToken?: string): void {
    sessionStorage.setItem(ACCESS_KEY, accessToken);

    if (refreshToken) {
      sessionStorage.setItem(REFRESH_KEY, refreshToken);
    } else {
      sessionStorage.removeItem(REFRESH_KEY);
    }
  },

  clear(): void {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  },

  onUnauthorized(): void {
    unauthorizedHandler?.();
  },

  setUnauthorizedHandler(handler: (() => void) | null): void {
    unauthorizedHandler = handler;
  },
};