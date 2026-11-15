const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const read = (path) => readFileSync(path, 'utf8');

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

test('Portal uses the shared ToastProvider and mutations are feedback opt-in', () => {
  const toast = read('src/shared/ui/Toast.tsx');
  const mutation = read('src/shared/hooks/useApiMutation.ts');

  assert.match(toast, /const pendingErrors/);
  assert.match(toast, /recent\.current/);
  assert.match(mutation, /options\.notify \?\? message !== undefined/);
  assert.match(mutation, /options\.notify \?\? options\.success !== undefined/);
  assert.doesNotMatch(mutation, /if \(options\.notify !== false\)/);

  for (const path of sourceFiles('src')) {
    assert.doesNotMatch(read(path), /from ['"]sonner['"]/,
      `${path} must use the shared ToastProvider, not a parallel toast system.`);
  }
});
