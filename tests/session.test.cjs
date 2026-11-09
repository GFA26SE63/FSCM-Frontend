const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function createStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key)
        ? values.get(key)
        : null;
    },

    setItem(key, value) {
      values.set(key, String(value));
    },

    removeItem(key) {
      values.delete(key);
    },

    clear() {
      values.clear();
    },

    get length() {
      return values.size;
    },
  };
}

function loadStore() {
  const filename = path.resolve(
    __dirname,
    '../src/shared/auth/tokenStore.ts',
  );

  const code = ts.transpileModule(
    fs.readFileSync(filename, 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;

  const sessionStorage = createStorage();
  const localStorage = createStorage();
  let sequence = 0;

  const module = { exports: {} };

  new Function(
    'module',
    'exports',
    'sessionStorage',
    'localStorage',
    'crypto',
    code,
  )(
    module,
    module.exports,
    sessionStorage,
    localStorage,
    {
      randomUUID: () =>
        `session-${++sequence}`,
    },
  );

  return {
    tokenStore:
      module.exports.tokenStore,
    sessionStorage,
    localStorage,
  };
}

function tokens(suffix = '1') {
  return {
    accessToken: `access-${suffix}`,
    accessTokenExpiresAt:
      new Date(
        Date.now() + 60_000,
      ).toISOString(),

    refreshToken: `refresh-${suffix}`,
    refreshTokenExpiresAt:
      new Date(
        Date.now() + 3_600_000,
      ).toISOString(),
  };
}

test('Remember off stores the session only in sessionStorage', () => {
  const {
    tokenStore,
    sessionStorage,
    localStorage,
  } = loadStore();

  tokenStore.set(tokens(), false);

  assert.equal(
    sessionStorage.length,
    1,
  );

  assert.equal(
    localStorage.length,
    0,
  );

  assert.equal(
    tokenStore.get(),
    'access-1',
  );

  sessionStorage.clear();

  assert.equal(
    tokenStore.hasSession(),
    false,
  );
});

test('Remember on survives clearing sessionStorage', () => {
  const {
    tokenStore,
    sessionStorage,
    localStorage,
  } = loadStore();

  tokenStore.set(tokens(), true);

  assert.equal(
    sessionStorage.length,
    0,
  );

  assert.equal(
    localStorage.length,
    1,
  );

  sessionStorage.clear();

  assert.equal(
    tokenStore.getRefreshToken(),
    'refresh-1',
  );
});

test('Rotation replaces both tokens and preserves persistence', () => {
  const {
    tokenStore,
    sessionStorage,
    localStorage,
  } = loadStore();

  const session = tokenStore.set(
    tokens('1'),
    true,
  );

  assert.equal(
    tokenStore.rotate(
      session.id,
      tokens('2'),
    ),
    true,
  );

  assert.equal(
    tokenStore.get(),
    'access-2',
  );

  assert.equal(
    tokenStore.getRefreshToken(),
    'refresh-2',
  );

  assert.equal(
    sessionStorage.length,
    0,
  );

  assert.equal(
    localStorage.length,
    1,
  );
});

test('An old refresh cannot overwrite a newer login', () => {
  const { tokenStore } = loadStore();

  const previous = tokenStore.set(
    tokens('old'),
    false,
  );

  tokenStore.set(
    tokens('new'),
    false,
  );

  assert.equal(
    tokenStore.rotate(
      previous.id,
      tokens('stale'),
    ),
    false,
  );

  assert.equal(
    tokenStore.get(),
    'access-new',
  );
});

test('Logout clears session and persistent authentication', () => {
  const {
    tokenStore,
    sessionStorage,
    localStorage,
  } = loadStore();

  tokenStore.set(tokens(), true);
  tokenStore.clear();

  assert.equal(
    tokenStore.hasSession(),
    false,
  );

  assert.equal(
    sessionStorage.length,
    0,
  );

  assert.equal(
    localStorage.length,
    0,
  );
});