const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} };
  const imports = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error('Missing boundary mock: ' + name + ' in ' + file);
  };
  new Function('require', 'module', 'exports', code)(imports, module, module.exports);
  return module.exports;
}

test('forgot-password submits only the normalized email to the backend contract', async () => {
  const calls = [];
  const identityHttp = {
    post: async (url, body) => {
      calls.push({ url, body });
      return { data: { message: 'Accepted' } };
    },
  };
  const errors = source('shared/api/errors.ts', {
    axios: { __esModule: true, default: { isAxiosError: () => false } },
  });
  const { authApi } = source('shared/auth/authApi.ts', {
    axios: { __esModule: true, default: { create: () => identityHttp } },
    '../api/http': { get: async () => ({}) },
    '../api/errors': errors,
    '../lib/env': { env: { apiBaseUrl: 'https://api.example.test' } },
    './roles': { isPortalRole: () => true },
  });

  const result = await authApi.requestPasswordReset('  user@example.com  ');

  assert.deepEqual(calls, [{
    url: '/password-reset/request',
    body: { email: 'user@example.com' },
  }]);
  assert.equal(result.message, 'Accepted');
});

test('remember-login UI never persists the password', () => {
  const loginSource = fs.readFileSync(
    path.resolve(__dirname, '../src/app/pages/LoginPage.tsx'),
    'utf8',
  );

  assert.match(loginSource, /fscm\.remembered-login-email/);
  assert.doesNotMatch(loginSource, /localStorage\.setItem\([^,]+,\s*password/);
  assert.match(loginSource, /Quên mật khẩu\?/);
  assert.match(loginSource, /aria-label=\{showPassword \? 'Ẩn mật khẩu' : 'Hiện mật khẩu'\}/);
  assert.match(loginSource, /width="368"/);
  const mainSource = fs.readFileSync(
    path.resolve(__dirname, '../src/app/main.tsx'),
    'utf8',
  );
  assert.match(mainSource, /GoogleOAuthProvider clientId=\{env\.google\.clientId\} locale="vi"/);
});

test('successful login uses the user returned with the session without a second me request', () => {
  const contextSource = fs.readFileSync(
    path.resolve(__dirname, '../src/shared/auth/AuthContext.tsx'),
    'utf8',
  );

  const authenticateBody = contextSource.slice(
    contextSource.indexOf('const authenticate'),
    contextSource.indexOf('const loginWithPassword'),
  );

  assert.match(authenticateBody, /const currentUser = session\.user/);
  assert.doesNotMatch(authenticateBody, /authApi\.me\(\)/);
});
