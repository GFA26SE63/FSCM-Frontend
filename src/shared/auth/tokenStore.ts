const KEY = 'fscm.portal.token';
let unauthorizedHandler: (() => void) | null = null;

/** Access token storage (sessionStorage – cleared when the tab closes). */
export const tokenStore = {
  get: (): string | null => sessionStorage.getItem(KEY),
  set: (token: string) => sessionStorage.setItem(KEY, token),
  clear: () => sessionStorage.removeItem(KEY),
  onUnauthorized: () => unauthorizedHandler?.(),
  setUnauthorizedHandler: (fn: (() => void) | null) => {
    unauthorizedHandler = fn;
  },
};
