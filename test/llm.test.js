// Tests for src/main/llm.js generateAnswer() with a fake electron module and a
// stubbed global fetch — no Electron runtime, no real network calls.
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const fs = require('fs');
const os = require('os');
const path = require('path');

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aihelper-llm-test-'));
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return { app: { getPath: () => userDataDir } };
  return origLoad.apply(this, arguments);
};

const store = require('../src/main/store.js');
const { generateAnswer } = require('../src/main/llm.js');

// ---------- fetch stubbing ----------
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

// Build an OpenAI/DeepSeek-style SSE data line.
function sseLine(content) {
  return 'data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n';
}

// A minimal Response-like object whose body streams the given strings as bytes.
function streamResponse(strChunks) {
  const enc = new TextEncoder();
  const chunks = strChunks.map((s) => enc.encode(s));
  let i = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          read: async () =>
            i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined },
          cancel: async () => {}
        };
      }
    }
  };
}

function errorResponse(status, bodyText = 'error body') {
  return { ok: false, status, text: async () => bodyText };
}

// ---------- tests ----------

test('rejects without calling the network when the API key is not set', async () => {
  store.set({ deepseekKey: '' });
  stubFetch(() => streamResponse([]));
  await assert.rejects(() => generateAnswer('transcript', () => {}));
  assert.equal(fetchCalls.length, 0, 'must not hit the network without a key');
});

test('a whitespace-only key counts as missing', async () => {
  store.set({ deepseekKey: '   ' });
  stubFetch(() => streamResponse([]));
  await assert.rejects(() => generateAnswer('transcript', () => {}));
  assert.equal(fetchCalls.length, 0);
});

test('rejects on HTTP 401 from the API', async () => {
  store.set({ deepseekKey: 'sk-test' });
  stubFetch(() => errorResponse(401, 'unauthorized'));
  await assert.rejects(() => generateAnswer('transcript', () => {}));
});

test('rejects on non-401 HTTP errors too', async () => {
  store.set({ deepseekKey: 'sk-test' });
  stubFetch(() => errorResponse(500, 'server exploded'));
  await assert.rejects(() => generateAnswer('transcript', () => {}), /500/);
});

test('sends a POST with the key in the Authorization header and the transcript in the body', async () => {
  store.set({ deepseekKey: 'sk-abc123', resume: 'RESUME_MARKER_TEXT', jobDescription: 'JD_MARKER_TEXT' });
  stubFetch(() => streamResponse([sseLine('ok'), 'data: [DONE]\n']));

  await generateAnswer('UNIQUE_TRANSCRIPT_MARKER', () => {});

  assert.equal(fetchCalls.length, 1);
  const [url, opts] = fetchCalls[0];
  assert.ok(String(url).startsWith('https://'), 'talks to an https endpoint');
  assert.equal(String(opts.method).toUpperCase(), 'POST');
  assert.ok(JSON.stringify(opts.headers).includes('sk-abc123'), 'API key sent in headers');

  const body = JSON.parse(opts.body);
  assert.equal(body.stream, true, 'requests a streamed response');
  const allMessages = JSON.stringify(body.messages);
  assert.ok(allMessages.includes('UNIQUE_TRANSCRIPT_MARKER'), 'transcript is sent to the model');
  assert.ok(allMessages.includes('RESUME_MARKER_TEXT'), 'resume from the store reaches the prompt');
  assert.ok(allMessages.includes('JD_MARKER_TEXT'), 'job description from the store reaches the prompt');
});

test('assembles streamed deltas into the full answer and forwards each to onChunk', async () => {
  store.set({ deepseekKey: 'sk-test' });
  stubFetch(() =>
    streamResponse([sseLine('Hel'), sseLine('lo, '), sseLine('world'), 'data: [DONE]\n'])
  );

  const received = [];
  const full = await generateAnswer('anything', (c) => received.push(c));
  assert.equal(full, 'Hello, world');
  assert.equal(received.join(''), full, 'onChunk deltas concatenate to the returned answer');
  assert.ok(received.length >= 2, 'answer arrives incrementally, not as one blob');
});

test('handles SSE lines split across network chunk boundaries', async () => {
  store.set({ deepseekKey: 'sk-test' });
  const line1 = sseLine('part one ');
  const line2 = sseLine('part two');
  // Split mid-line in two places to exercise the carry-over buffer.
  stubFetch(() =>
    streamResponse([line1.slice(0, 12), line1.slice(12) + line2.slice(0, 5), line2.slice(5), 'data: [DONE]\n'])
  );

  const full = await generateAnswer('anything', () => {});
  assert.equal(full, 'part one part two');
});

test('skips malformed stream lines instead of failing the whole answer', async () => {
  store.set({ deepseekKey: 'sk-test' });
  stubFetch(() =>
    streamResponse(['data: {broken json\n', sseLine('good'), ': keep-alive\n', 'data: [DONE]\n'])
  );
  const full = await generateAnswer('anything', () => {});
  assert.equal(full, 'good');
});

test('retries a transient server error and succeeds on a later attempt', async () => {
  store.set({ deepseekKey: 'sk-test' });
  let call = 0;
  stubFetch(() => {
    call += 1;
    return call === 1
      ? errorResponse(500, 'transient blip')
      : streamResponse([sseLine('recovered'), 'data: [DONE]\n']);
  });

  const full = await generateAnswer('anything', () => {});
  assert.equal(full, 'recovered');
  assert.ok(fetchCalls.length >= 2, 'a second attempt was made after the 5xx');
});

test('returns an empty string for a stream with no content deltas', async () => {
  store.set({ deepseekKey: 'sk-test' });
  stubFetch(() => streamResponse(['data: [DONE]\n']));
  const received = [];
  const full = await generateAnswer('anything', (c) => received.push(c));
  assert.equal(full, '');
  assert.deepEqual(received, []);
});
