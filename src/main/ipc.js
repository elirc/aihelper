const { ipcMain } = require('electron');
const store = require('./store');
const { transcribe } = require('./stt');
const { generateAnswer } = require('./llm');

// ---- Renderer input limits ---------------------------------------------
// The renderer caps clips at 120 s of 16 kHz 16-bit mono (~3.8 MB); allow
// generous headroom while still bounding main-process memory.
const MAX_WAV_BYTES = 32 * 1024 * 1024;
const MIN_WAV_BYTES = 44; // a WAV file is at least a RIFF header
const MAX_KEY_LEN = 512;
const MAX_TEXT_LEN = 200000;

// Whitelist of settings the renderer may write, with per-key validators.
// Anything not listed here is dropped; anything listed but malformed rejects
// the whole request. The store never sees raw renderer data.
const SETTING_VALIDATORS = {
  alwaysOnTop: (v) => typeof v === 'boolean',
  siliconflowKey: (v) => typeof v === 'string' && v.length <= MAX_KEY_LEN,
  deepseekKey: (v) => typeof v === 'string' && v.length <= MAX_KEY_LEN,
  resume: (v) => typeof v === 'string' && v.length <= MAX_TEXT_LEN,
  jobDescription: (v) => typeof v === 'string' && v.length <= MAX_TEXT_LEN
};

function sanitizeSettings(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new TypeError('Settings payload must be an object.');
  }
  const clean = {};
  for (const [key, isValid] of Object.entries(SETTING_VALIDATORS)) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    if (!isValid(obj[key])) throw new TypeError(`Invalid value for setting "${key}".`);
    clean[key] = obj[key];
  }
  return clean;
}

// Accept the WAV payload as an ArrayBuffer (what the renderer sends) or a
// typed-array view of one, and return it as a bounded Buffer.
function toWavBuffer(payload) {
  let buf;
  if (payload instanceof ArrayBuffer) {
    buf = Buffer.from(payload);
  } else if (ArrayBuffer.isView(payload)) {
    buf = Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  } else {
    throw new TypeError('Expected the recording as an ArrayBuffer.');
  }
  if (buf.byteLength < MIN_WAV_BYTES) {
    throw new Error('Recording payload is too small to be valid audio.');
  }
  if (buf.byteLength > MAX_WAV_BYTES) {
    throw new Error('Recording is too large to process. Try a shorter clip.');
  }
  return buf;
}

function registerIpc(getWin) {
  ipcMain.handle('settings:get', () => store.all());

  ipcMain.handle('settings:set', (_e, obj) => {
    const clean = sanitizeSettings(obj);
    store.set(clean);
    const win = getWin();
    if (win && !win.isDestroyed() && typeof clean.alwaysOnTop === 'boolean') {
      win.setAlwaysOnTop(clean.alwaysOnTop);
    }
  });

  // Full pipeline: WAV clip -> transcript -> streamed answer.
  // Only one request at a time: the UI already serializes this, so a second
  // concurrent call can only come from misuse.
  let askInFlight = false;
  ipcMain.handle('ask', async (e, wavArrayBuffer) => {
    const wavBuffer = toWavBuffer(wavArrayBuffer);
    if (askInFlight) {
      throw new Error('A recording is already being processed. Wait for it to finish.');
    }
    askInFlight = true;
    try {
      const transcript = await transcribe(wavBuffer);
      if (!transcript) {
        throw new Error('No speech detected in the recording. Make sure call audio is playing.');
      }
      if (!e.sender.isDestroyed()) e.sender.send('transcript', transcript);
      const answer = await generateAnswer(transcript, (chunk) => {
        if (!e.sender.isDestroyed()) e.sender.send('answer-chunk', chunk);
      });
      return { transcript, answer };
    } finally {
      askInFlight = false;
    }
  });
}

module.exports = { registerIpc };
