const store = require('./store');
const { parseSSEChunk } = require('./sse');
const { buildSystemPrompt, truncateTranscript } = require('./prompt');

const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';

const CONNECT_TIMEOUT_MS = 15000; // time allowed to receive response headers
const IDLE_TIMEOUT_MS = 30000;    // max silence between stream chunks
const MAX_RETRIES = 2;            // extra attempts on 429/5xx/network failure (only before any output)
const RETRY_BASE_DELAY_MS = 800;  // backoff: 800ms, then 1600ms

// Strip the API key from any text headed for an error message or log.
function redactKey(text, key) {
  if (!text) return '';
  return key ? text.split(key).join('[REDACTED]') : text;
}

function cancelledError() {
  return new Error('Answer generation was cancelled.');
}

// Map an HTTP status to a user-actionable error, without ever echoing the key.
function statusError(status, body) {
  if (status === 401 || status === 403) {
    return new Error(`DeepSeek rejected the API key (HTTP ${status}). Check it in Settings (gear icon).`);
  }
  if (status === 402) {
    return new Error('DeepSeek reports insufficient account balance (HTTP 402). Top up your DeepSeek account.');
  }
  if (status === 429) {
    return new Error('DeepSeek rate limit reached (HTTP 429). Wait a few seconds and try again.');
  }
  if (status >= 500) {
    return new Error(`DeepSeek server error (HTTP ${status}). This is usually temporary — try again shortly.`);
  }
  return new Error(`Answer generation failed (HTTP ${status})${body ? ': ' + body : ''}`);
}

// Cancellable backoff sleep.
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(onDone, ms);
    function onDone() { cleanup(); resolve(); }
    function onAbort() { cleanup(); reject(cancelledError()); }
    function cleanup() {
      clearTimeout(t);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

// Stream an answer for the transcript; onChunk receives each text delta.
// Returns the full answer text.
//
// opts.signal (optional AbortSignal): abort it to cancel an in-flight request or
// stream cleanly; the promise then rejects with "Answer generation was cancelled."
async function generateAnswer(transcript, onChunk, opts = {}) {
  const key = store.get('deepseekKey', '').trim();
  if (!key) throw new Error('DeepSeek API key is not set. Open Settings (gear icon) and add it.');

  const emit = typeof onChunk === 'function' ? onChunk : () => {};
  const outerSignal = opts.signal;

  const requestBody = JSON.stringify({
    model: MODEL,
    stream: true,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(store.get('resume', ''), store.get('jobDescription', ''))
      },
      {
        role: 'user',
        content: 'The other person on the call just said:\n"""\n' + truncateTranscript(transcript || '') +
          '\n"""\n\nWhat should I say?'
      }
    ]
  });

  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (outerSignal && outerSignal.aborted) throw cancelledError();
    if (attempt > 0) await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), outerSignal);

    const ctrl = new AbortController();
    const timedOut = { value: false };
    const onOuterAbort = () => ctrl.abort();
    if (outerSignal) outerSignal.addEventListener('abort', onOuterAbort, { once: true });
    const connectTimer = setTimeout(() => { timedOut.value = true; ctrl.abort(); }, CONNECT_TIMEOUT_MS);

    try {
      let res;
      try {
        res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`
          },
          body: requestBody,
          signal: ctrl.signal
        });
      } catch {
        if (outerSignal && outerSignal.aborted) throw cancelledError();
        lastError = timedOut.value
          ? new Error(`DeepSeek did not respond within ${CONNECT_TIMEOUT_MS / 1000}s. Check your internet connection and try again.`)
          : new Error('Could not reach DeepSeek. Check your internet connection and try again.');
        continue; // network failures and connect timeouts are retryable
      } finally {
        clearTimeout(connectTimer);
      }

      if (!res.ok) {
        const body = redactKey((await res.text().catch(() => '')).slice(0, 300), key);
        const err = statusError(res.status, body);
        if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
          lastError = err;
          continue; // transient — retry with backoff
        }
        throw err;
      }

      // Nothing has been emitted yet, so failures above were safe to retry.
      // From here on we are streaming; a mid-stream failure must not retry
      // (chunks have already reached the UI).
      return await readAnswerStream(res, ctrl, emit, outerSignal, timedOut);
    } finally {
      if (outerSignal) outerSignal.removeEventListener('abort', onOuterAbort);
    }
  }
  throw lastError || new Error('Answer generation failed after retries.');
}

async function readAnswerStream(res, ctrl, emit, outerSignal, timedOut) {
  if (!res.body) throw new Error('DeepSeek returned an empty response stream. Try again.');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  let idleTimer = null;
  const armIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { timedOut.value = true; ctrl.abort(); }, IDLE_TIMEOUT_MS);
  };
  armIdle();

  try {
    for (;;) {
      let step;
      try {
        step = await reader.read();
      } catch {
        if (outerSignal && outerSignal.aborted) throw cancelledError();
        if (timedOut.value) {
          throw new Error(`DeepSeek stream stalled (no data for ${IDLE_TIMEOUT_MS / 1000}s). Try again.`);
        }
        throw new Error('Connection to DeepSeek dropped mid-answer. Check your network and try again.');
      }
      if (step.done) break;
      armIdle();

      buf += decoder.decode(step.value, { stream: true });
      const { deltas, rest, done } = parseSSEChunk(buf);
      buf = rest;
      for (const delta of deltas) {
        full += delta;
        emit(delta);
      }
      if (done) {
        // [DONE] sentinel seen — stop reading without waiting for socket close.
        reader.cancel().catch(() => {});
        break;
      }
    }

    // Flush any multi-byte sequence held by the decoder and any final line
    // that arrived without a trailing newline.
    buf += decoder.decode();
    if (buf.trim()) {
      const { deltas } = parseSSEChunk(buf.endsWith('\n') ? buf : buf + '\n');
      for (const delta of deltas) {
        full += delta;
        emit(delta);
      }
    }
    return full;
  } finally {
    clearTimeout(idleTimer);
  }
}

module.exports = { generateAnswer };
