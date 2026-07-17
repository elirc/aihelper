// Persistence round-trip tests for src/main/store.js.
//
// store.js requires the `electron` module only for `app.getPath('userData')`.
// Since each test file runs in its own process under `node --test`, we can
// safely intercept Module._load and hand store.js a fake `app` that points at
// a throw-away temp directory — no Electron runtime needed and no real user
// settings are touched.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const fs = require('fs');
const os = require('os');
const path = require('path');

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aihelper-store-test-'));

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return { app: { getPath: () => userDataDir } };
  }
  return origLoad.apply(this, arguments);
};

const STORE_ID = require.resolve('../src/main/store.js');
const settingsFile = path.join(userDataDir, 'settings.json');

// Re-require store.js with a clean module (and therefore clean in-memory cache),
// simulating an app restart.
function freshStore() {
  delete require.cache[STORE_ID];
  return require(STORE_ID);
}

// Wipe persisted state between tests.
function resetDisk(contents) {
  try { fs.rmSync(settingsFile, { force: true }); } catch {}
  if (contents !== undefined) fs.writeFileSync(settingsFile, contents);
}

after(() => {
  Module._load = origLoad;
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
});

test('get returns the default when nothing has been persisted', () => {
  resetDisk();
  const store = freshStore();
  assert.equal(store.get('missingKey', 'fallback'), 'fallback');
  assert.equal(store.get('missingKey'), undefined);
});

test('set then get round-trips in the same session', () => {
  resetDisk();
  const store = freshStore();
  store.set({ deepseekKey: 'sk-123', resume: 'my resume' });
  assert.equal(store.get('deepseekKey'), 'sk-123');
  assert.equal(store.get('resume'), 'my resume');
});

test('values persist across a simulated app restart', () => {
  resetDisk();
  const store = freshStore();
  store.set({ alpha: 1, nested: { a: [1, 2, 3] }, flag: false });

  const reloaded = freshStore(); // new module instance -> must read from disk
  assert.equal(reloaded.get('alpha'), 1);
  assert.deepEqual(reloaded.get('nested'), { a: [1, 2, 3] });
  assert.equal(reloaded.get('flag'), false, 'falsy stored values are returned, not the default');
  assert.equal(reloaded.get('flag', true), false);
});

test('set merges new keys with existing ones instead of replacing the file', () => {
  resetDisk();
  let store = freshStore();
  store.set({ first: 'one' });
  store = freshStore();
  store.set({ second: 'two' });

  const reloaded = freshStore();
  assert.equal(reloaded.get('first'), 'one');
  assert.equal(reloaded.get('second'), 'two');
});

test('the settings file on disk is valid JSON under the userData dir', () => {
  resetDisk();
  const store = freshStore();
  store.set({ probe: 'value' });
  assert.ok(fs.existsSync(settingsFile), 'settings.json exists in userData');
  const onDisk = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  assert.equal(onDisk.probe, 'value');
});

test('a corrupted settings file falls back to defaults instead of throwing', () => {
  resetDisk('{{{ not json');
  const store = freshStore();
  assert.equal(store.get('anything', 'safe-default'), 'safe-default');
  // and the store remains usable for writes afterwards
  store.set({ recovered: true });
  assert.equal(freshStore().get('recovered'), true);
});

test('all() returns a detached copy, not the live internal object', () => {
  resetDisk();
  const store = freshStore();
  store.set({ keep: 'original' });
  const snapshot = store.all();
  assert.equal(snapshot.keep, 'original');
  snapshot.keep = 'mutated';
  snapshot.injected = 'nope';
  assert.equal(store.get('keep'), 'original', 'mutating the snapshot must not affect the store');
  assert.equal(store.get('injected'), undefined);
});
