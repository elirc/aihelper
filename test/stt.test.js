// Tests for src/main/stt.js transcribe() with a fake electron module and a
// stubbed global fetch — no Electron runtime, no real network calls.
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const fs = require('fs');
const os = require('os');
const path = require('path');

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aihelper-stt-test-'));
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return { app: { getPath: () => userDataDir } };
  return origLoad.apply(this, arguments);
};

const store = require('../src/main/store.js');
const { transcribe } = require('../src/main/stt.js');

const realFetch = global.fetch;
let fetchCalls;

function stubFetch(impl) {
  global.fetch = async (...args) => {
    fetchCalls.push(args);
    return impl(...args);
  };
}

beforeEach(() => {
  fetchCalls = [];
  global.fetch = async () => { throw new Error('unexpected fetch — stub not installed'); };
});

after(() => {
  global.fetch = realFetch;
  Module._load = origLoad;
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
});

function jsonResponse(obj, status = 200) {
  return { ok: status < 400, status, json: async () => obj, text: async () => JSON.stringify(obj) };
}

// A genuine (silent) WAV clip built with the app's own encoder — large enough
// to pass any sanity checks on size and RIFF/WAVE structure.
const { encodeWav } = require('../src/renderer/audio.js');
const wav = Buffer.from(encodeWav(new Float32Array(16000), 16000)); // 1s of silence @16kHz

// ---------- tests ----------

test('rejects without calling the network when the API key is not set', async () => {
  store.set({ siliconflowKey: '' });
  stubFetch(() => jsonResponse({ text: 'never' }));
  await assert.rejects(() => transcribe(wav));
  assert.equal(fetchCalls.length, 0, 'must not hit the network without a key');
});

test('a whitespace-only key counts as missing', async () => {
  store.set({ siliconflowKey: '  \t ' });
  stubFetch(() => jsonResponse({ text: 'never' }));
  await assert.rejects(() => transcribe(wav));
  assert.equal(fetchCalls.length, 0);
});

test('rejects on HTTP 401', async () => {
  store.set({ siliconflowKey: 'sf-test' });
  stubFetch(() => ({ ok: false, status: 401, text: async () => 'unauthorized' }));
  await assert.rejects(() => transcribe(wav));
});

test('rejects on other HTTP errors', async () => {
  store.set({ siliconflowKey: 'sf-test' });
  stubFetch(() => ({ ok: false, status: 503, text: async () => 'service unavailable' }));
  await assert.rejects(() => transcribe(wav), /503/);
});

test('POSTs with the key in the Authorization header and an upload body', async () => {
  store.set({ siliconflowKey: 'sf-key-789' });
  stubFetch(() => jsonResponse({ text: 'hello' }));

  await transcribe(wav);

  assert.equal(fetchCalls.length, 1);
  const [url, opts] = fetchCalls[0];
  assert.ok(String(url).startsWith('https://'), 'talks to an https endpoint');
  assert.equal(String(opts.method).toUpperCase(), 'POST');
  assert.ok(JSON.stringify(opts.headers).includes('sf-key-789'), 'API key sent in headers');
  assert.ok(opts.body, 'audio payload is sent in the request body');
});

test('returns the transcription text trimmed of whitespace', async () => {
  store.set({ siliconflowKey: 'sf-test' });
  stubFetch(() => jsonResponse({ text: '  hello there \n' }));
  assert.equal(await transcribe(wav), 'hello there');
});

test('returns an empty string when the API response has no text field', async () => {
  store.set({ siliconflowKey: 'sf-test' });
  stubFetch(() => jsonResponse({}));
  assert.equal(await transcribe(wav), '');
});

test('rejects an obviously unusable audio payload without hitting the network', async () => {
  store.set({ siliconflowKey: 'sf-test' });
  stubFetch(() => jsonResponse({ text: 'never' }));
  // A few bytes cannot be a speech recording; current source validates this pre-upload.
  await assert.rejects(() => transcribe(Buffer.from('tiny')));
  assert.equal(fetchCalls.length, 0);
});

test('retries a transient server error and succeeds on a later attempt', async () => {
  store.set({ siliconflowKey: 'sf-test' });
  let call = 0;
  stubFetch(() => {
    call += 1;
    return call === 1
      ? { ok: false, status: 500, text: async () => 'blip' }
      : jsonResponse({ text: 'recovered transcript' });
  });
  assert.equal(await transcribe(wav), 'recovered transcript');
  assert.ok(fetchCalls.length >= 2, 'a second attempt was made after the 5xx');
});
