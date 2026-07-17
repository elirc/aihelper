const store = require('./store');

const STT_URL = 'https://api.siliconflow.com/v1/audio/transcriptions';
const STT_MODEL = 'FunAudioLLM/SenseVoice-Small';

const TIMEOUT_MS = 30000;              // covers upload + response body
const MAX_RETRIES = 2;                 // extra attempts on 429/5xx/network failure
const RETRY_BASE_DELAY_MS = 600;       // backoff: 600ms, then 1200ms
const MIN_WAV_BYTES = 1024;            // 44-byte header + a few ms of samples; below this there is no speech
const MAX_WAV_BYTES = 25 * 1024 * 1024;

// Strip the API key from any text headed for an error message or log.
function redactKey(text, key) {
  if (!text) return '';
  return key ? text.split(key).join('[REDACTED]') : text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Map an HTTP status to a user-actionable error, without ever echoing the key.
function statusError(status, body) {
  if (status === 401 || status === 403) {
    return new Error(`SiliconFlow rejected the API key (HTTP ${status}). Check it in Settings (gear icon).`);
  }
  if (status === 402) {
    return new Error('SiliconFlow reports insufficient account balance (HTTP 402). Top up your SiliconFlow account.');
  }
  if (status === 413) {
    return new Error('The recording is too large for the transcription service (HTTP 413). Record a shorter clip.');
  }
  if (status === 429) {
    return new Error('SiliconFlow rate limit reached (HTTP 429). Wait a few seconds and try again.');
  }
  if (status >= 500) {
    return new Error(`SiliconFlow server error (HTTP ${status}). This is usually temporary — try again shortly.`);
  }
  return new Error(`Transcription failed (HTTP ${status})${body ? ': ' + body : ''}`);
}

// Reject clearly unusable payloads before spending an upload on them.
function validateWav(wavBuffer) {
  if (!wavBuffer || !(wavBuffer instanceof Uint8Array) || wavBuffer.length === 0) {
    throw new Error('No audio data was captured. Try recording again.');
  }
  if (wavBuffer.length < MIN_WAV_BYTES) {
    throw new Error('The recording is too short to contain speech. Record for a little longer.');
  }
  if (wavBuffer.length > MAX_WAV_BYTES) {
    throw new Error('The recording is too large to upload (limit 25 MB). Record a shorter clip.');
  }
  const riff = wavBuffer[0] === 0x52 && wavBuffer[1] === 0x49 && wavBuffer[2] === 0x46 && wavBuffer[3] === 0x46; // "RIFF"
  const wave = wavBuffer[8] === 0x57 && wavBuffer[9] === 0x41 && wavBuffer[10] === 0x56 && wavBuffer[11] === 0x45; // "WAVE"
  if (!riff || !wave) {
    throw new Error('The captured audio is not a valid WAV clip. Try recording again.');
  }
}

// Transcribe a WAV clip (Buffer) with SiliconFlow SenseVoice.
// Returns the transcript text, or '' when the service heard no speech
// (the caller treats an empty transcript as "no speech detected").
//
// opts.signal (optional AbortSignal): abort it to cancel the upload cleanly.
async function transcribe(wavBuffer, opts = {}) {
  const key = store.get('siliconflowKey', '').trim();
  if (!key) throw new Error('SiliconFlow API key is not set. Open Settings (gear icon) and add it.');

  validateWav(wavBuffer);
  const outerSignal = opts.signal;

  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (outerSignal && outerSignal.aborted) throw new Error('Transcription was cancelled.');
    if (attempt > 0) await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));

    // Rebuild the form each attempt: a consumed multipart body is not reusable.
    const form = new FormData();
    form.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'clip.wav');
    form.append('model', STT_MODEL);

    const ctrl = new AbortController();
    let timedOut = false;
    const onOuterAbort = () => ctrl.abort();
    if (outerSignal) outerSignal.addEventListener('abort', onOuterAbort, { once: true });
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, TIMEOUT_MS);

    let res;
    let rawBody;
    try {
      res = await fetch(STT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: ctrl.signal
      });
      rawBody = await res.text(); // read under the same timeout as the upload
    } catch {
      if (outerSignal && outerSignal.aborted) throw new Error('Transcription was cancelled.');
      lastError = timedOut
        ? new Error(`Transcription timed out after ${TIMEOUT_MS / 1000}s. Check your internet connection and try again.`)
        : new Error('Could not reach the transcription service. Check your internet connection and try again.');
      continue; // network failures and timeouts are retryable
    } finally {
      clearTimeout(timer);
      if (outerSignal) outerSignal.removeEventListener('abort', onOuterAbort);
    }

    if (!res.ok) {
      const err = statusError(res.status, redactKey(rawBody.slice(0, 300), key));
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        lastError = err;
        continue; // transient — retry with backoff
      }
      throw err;
    }

    let data;
    try {
      data = JSON.parse(rawBody);
    } catch {
      throw new Error('The transcription service returned an unreadable response. Try again.');
    }
    return (typeof data.text === 'string' ? data.text : '').trim();
  }
  throw lastError || new Error('Transcription failed after retries.');
}

module.exports = { transcribe };
