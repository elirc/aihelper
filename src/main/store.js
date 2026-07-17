const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

// Minimal JSON settings store in %APPDATA%/AI Call Assistant/settings.json.
//
// API keys are encrypted at rest with Electron's safeStorage (DPAPI on
// Windows) whenever OS-level encryption is available; if it is not, values
// are stored as-is so the app keeps working. Writes are atomic (temp file +
// rename) and a corrupt settings file is set aside rather than crashing.

const SECRET_KEYS = ['siliconflowKey', 'deepseekKey'];
const ENC_PREFIX = 'enc:v1:'; // marks a safeStorage-encrypted, base64-encoded value

let cache = null;

function filePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function encryptionAvailable() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false; // e.g. called before app is ready on some platforms
  }
}

function decryptValue(v) {
  if (typeof v !== 'string' || !v.startsWith(ENC_PREFIX)) return v;
  try {
    return safeStorage.decryptString(Buffer.from(v.slice(ENC_PREFIX.length), 'base64'));
  } catch {
    // Undecryptable (copied from another machine/user profile, or corrupted):
    // treat as unset so the user is prompted to re-enter the key.
    return '';
  }
}

function load() {
  if (cache) return cache;

  let raw = null;
  try {
    raw = fs.readFileSync(filePath(), 'utf8');
  } catch {
    // First run (or unreadable file) — start with defaults.
  }

  let parsed = {};
  if (raw !== null) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Corrupt JSON: keep the bad file for inspection instead of silently
      // overwriting it, then start fresh.
      try { fs.renameSync(filePath(), filePath() + '.corrupt'); } catch {}
      parsed = {};
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) parsed = {};

  let hadPlaintextSecret = false;
  for (const k of SECRET_KEYS) {
    if (typeof parsed[k] === 'string' && parsed[k] !== '' && !parsed[k].startsWith(ENC_PREFIX)) {
      hadPlaintextSecret = true;
    }
    if (parsed[k] !== undefined) parsed[k] = decryptValue(parsed[k]);
  }
  cache = parsed;

  // One-time migration: if plaintext secrets were found on disk and encryption
  // is available, re-persist immediately so they are encrypted at rest.
  if (hadPlaintextSecret && encryptionAvailable()) {
    try { persist(); } catch {}
  }
  return cache;
}

// Serialize the cache (encrypting secrets when possible) and write atomically.
function persist() {
  const data = { ...cache };
  if (encryptionAvailable()) {
    for (const k of SECRET_KEYS) {
      if (typeof data[k] === 'string' && data[k] !== '') {
        data[k] = ENC_PREFIX + safeStorage.encryptString(data[k]).toString('base64');
      }
    }
  }

  const file = filePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Atomic write: temp file in the same directory, then rename over the target
  // so a crash mid-write can never leave a half-written settings.json.
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  try {
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

module.exports = {
  get(key, def) {
    const v = load()[key];
    return v === undefined ? def : v;
  },
  set(obj) {
    Object.assign(load(), obj);
    persist();
  },
  all() {
    return { ...load() };
  }
};
