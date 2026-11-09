const SESSION_KEY = 'fscm.portal.session.v1';

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface StoredSession extends SessionTokens {
  id: string;
  remember: boolean;
}

let unauthorizedHandler: (() => void) | null = null;

function read(storage: Storage): StoredSession | null {
  const raw = storage.getItem(SESSION_KEY);

  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);

    if (
      typeof value !== 'object' ||
      value === null
    ) {
      return null;
    }

    const session = value as Partial<StoredSession>;

    if (
      typeof session.id !== 'string' ||
      typeof session.remember !== 'boolean' ||
      typeof session.accessToken !== 'string' ||
      typeof session.accessTokenExpiresAt !== 'string' ||
      typeof session.refreshToken !== 'string' ||
      typeof session.refreshTokenExpiresAt !== 'string'
    ) {
      return null;
    }

    return session as StoredSession;
  } catch {
    return null;
  }
}

function getSession(): StoredSession | null {
  return (
    read(sessionStorage) ??
    read(localStorage)
  );
}

function removeLegacyKeys(): void {
  // Dọn key của phiên bản cũ khi login/logout.
  const keys = [
    'fscm.portal.token',
    'fscm.portal.access-token',
    'fscm.portal.access-token-expires-at',
    'fscm.portal.refresh-token',
    'fscm.portal.refresh-token-expires-at',
    'fscm.portal.persistent-refresh-token',
    'fscm.portal.persistent-refresh-token-expires-at',
  ];

  for (const key of keys) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
}

function expired(
  expiresAt: string,
  skewMilliseconds = 0,
): boolean {
  const expiry = Date.parse(expiresAt);

  return (
    !Number.isFinite(expiry) ||
    expiry <= Date.now() + skewMilliseconds
  );
}

function clear(): void {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  removeLegacyKeys();
}

export const tokenStore = {
  getSession,

  get(): string | null {
    return getSession()?.accessToken ?? null;
  },

  getRefreshToken(): string | null {
    return getSession()?.refreshToken ?? null;
  },

  hasSession(): boolean {
    return getSession() !== null;
  },

  isAccessExpired(session: StoredSession): boolean {
    // Refresh sớm 15 giây để tránh token hết hạn giữa request.
    return expired(
      session.accessTokenExpiresAt,
      15_000,
    );
  },

  isRefreshExpired(session: StoredSession): boolean {
    return expired(session.refreshTokenExpiresAt);
  },

  set(
    tokens: SessionTokens,
    remember: boolean,
  ): StoredSession {
    clear();

    const session: StoredSession = {
      ...tokens,
      id: crypto.randomUUID(),
      remember,
    };

    const storage = remember
      ? localStorage
      : sessionStorage;

    storage.setItem(
      SESSION_KEY,
      JSON.stringify(session),
    );

    return session;
  },

  rotate(
    expectedSessionId: string,
    tokens: SessionTokens,
  ): boolean {
    const current = getSession();

    if (
      !current ||
      current.id !== expectedSessionId
    ) {
      return false;
    }

    const storage = current.remember
      ? localStorage
      : sessionStorage;

    storage.setItem(
      SESSION_KEY,
      JSON.stringify({
        ...current,
        ...tokens,
      } satisfies StoredSession),
    );

    return true;
  },

  clear,

  onUnauthorized(): void {
    clear();
    unauthorizedHandler?.();
  },

  setUnauthorizedHandler(
    handler: (() => void) | null,
  ): void {
    unauthorizedHandler = handler;
  },
};