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

const SESSION_CHANNEL = 'fscm.portal.session';
const SESSION_UPDATED_EVENT =
  'fscm:session-updated';
const SESSION_CLEARED_EVENT =
  'fscm:session-cleared';

type SessionMessage =
  | { type: 'request-session' }
  | {
      type: 'session';
      session: StoredSession;
    }
  | { type: 'clear-session' };

let sessionChannel: BroadcastChannel | null = null;
let sessionRequestResolvers: Array<
  (restored: boolean) => void
> = [];

function notify(
  eventName: string,
): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(eventName));
  }
}

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

function validSession(
  value: unknown,
): value is StoredSession {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const session = value as Partial<StoredSession>;

  return (
    typeof session.id === 'string' &&
    typeof session.remember === 'boolean' &&
    typeof session.accessToken === 'string' &&
    typeof session.accessTokenExpiresAt ===
      'string' &&
    typeof session.refreshToken === 'string' &&
    typeof session.refreshTokenExpiresAt ===
      'string'
  );
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

function saveSession(
  session: StoredSession,
): void {
  const storage = session.remember
    ? localStorage
    : sessionStorage;

  storage.setItem(
    SESSION_KEY,
    JSON.stringify(session),
  );
}

function publish(
  message: SessionMessage,
): void {
  sessionChannel?.postMessage(message);
}

function resolveSessionRequests(
  restored: boolean,
): void {
  const resolvers = sessionRequestResolvers;
  sessionRequestResolvers = [];

  resolvers.forEach((resolve) => resolve(restored));
}

function getSessionChannel(): BroadcastChannel | null {
  if (
    sessionChannel ||
    typeof BroadcastChannel === 'undefined'
  ) {
    return sessionChannel;
  }

  sessionChannel = new BroadcastChannel(
    SESSION_CHANNEL,
  );

  sessionChannel.onmessage = (
    event: MessageEvent<unknown>,
  ) => {
    const message = event.data as Partial<SessionMessage>;

    if (message?.type === 'request-session') {
      const session = getSession();

      if (session) {
        publish({ type: 'session', session });
      }

      return;
    }

    const current = getSession();

    if (
      message?.type === 'session' &&
      validSession(message.session) &&
      (!current || current.id === message.session.id)
    ) {
      // Chỉ nhận lại cùng sessionId để đồng bộ token rotation.
      // Login vào tài khoản khác không được phép ghi đè một tab
      // đang hoạt động bởi một message trễ của phiên cũ.
      saveSession(message.session);
      resolveSessionRequests(true);
      notify(SESSION_UPDATED_EVENT);
      return;
    }

    if (message?.type === 'clear-session') {
      clear();
      resolveSessionRequests(false);
      notify(SESSION_CLEARED_EVENT);
    }
  };

  return sessionChannel;
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

    saveSession(session);
    publish({ type: 'session', session });

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

    const next = {
      ...current,
      ...tokens,
    } satisfies StoredSession;

    saveSession(next);
    publish({ type: 'session', session: next });

    return true;
  },

  clear,

  requestSharedSession(): Promise<boolean> {
    if (getSession()) {
      return Promise.resolve(true);
    }

    if (!getSessionChannel()) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      sessionRequestResolvers.push(resolve);
      publish({ type: 'request-session' });

      window.setTimeout(() => {
        const index = sessionRequestResolvers.indexOf(
          resolve,
        );

        if (index >= 0) {
          sessionRequestResolvers.splice(index, 1);
          resolve(false);
        }
      }, 300);
    });
  },

  clearEverywhere(): void {
    clear();
    publish({ type: 'clear-session' });
  },

  startCrossTabSync(): void {
    getSessionChannel();
  },

  onUnauthorized(): void {
    this.clearEverywhere();
    unauthorizedHandler?.();
  },

  setUnauthorizedHandler(
    handler: (() => void) | null,
  ): void {
    unauthorizedHandler = handler;
  },
};
