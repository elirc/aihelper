const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mergeAndDownsample, encodeWav } = require('../src/renderer/audio.js');

// Read a little-endian value out of a WAV byte array.
function u32(bytes, off) {
  return bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24);
}
function ascii(bytes, off, len) {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[off + i]);
  return s;
}
function i16(bytes, off) {
  const v = bytes[off] | (bytes[off + 1] << 8);
  return v >= 0x8000 ? v - 0x10000 : v;
}

test('mergeAndDownsample concatenates chunks when rates match', () => {
  const out = mergeAndDownsample([Float32Array.of(0.1, 0.2), Float32Array.of(0.3)], 16000, 16000);
  assert.equal(out.length, 3);
  assert.ok(Math.abs(out[2] - 0.3) < 1e-6);
});

test('mergeAndDownsample halves length at a 2:1 ratio', () => {
  const input = new Float32Array(1000).fill(0.5);
  const out = mergeAndDownsample([input], 32000, 16000);
  assert.equal(out.length, 500);
  // A constant signal must stay constant through box averaging.
  assert.ok(Math.abs(out[10] - 0.5) < 1e-6);
});

test('mergeAndDownsample 48k->16k gives ~1/3 length and averages windows', () => {
  // Ramp 0,1,2,...,5; averaging groups of 3 -> [1, 4]
  const out = mergeAndDownsample([Float32Array.of(0, 1, 2, 3, 4, 5)], 48000, 16000);
  assert.equal(out.length, 2);
  assert.ok(Math.abs(out[0] - 1) < 1e-6);
  assert.ok(Math.abs(out[1] - 4) < 1e-6);
});

test('encodeWav writes a valid 44-byte header', () => {
  const wav = encodeWav(Float32Array.of(0, 0, 0, 0), 16000);
  assert.equal(ascii(wav, 0, 4), 'RIFF');
  assert.equal(ascii(wav, 8, 4), 'WAVE');
  assert.equal(ascii(wav, 12, 4), 'fmt ');
  assert.equal(ascii(wav, 36, 4), 'data');
  assert.equal(u32(wav, 24), 16000, 'sample rate field');
  assert.equal(u32(wav, 40), 8, 'data chunk = 4 samples * 2 bytes');
  assert.equal(wav.length, 44 + 8);
});

test('encodeWav quantizes samples to int16 and clamps out-of-range values', () => {
  const wav = encodeWav(Float32Array.of(0, 1, -1, 2), 16000);
  assert.equal(i16(wav, 44), 0);
  assert.equal(i16(wav, 46), 0x7fff);   // full-scale positive
  assert.equal(i16(wav, 48), -0x8000);  // full-scale negative
  assert.equal(i16(wav, 50), 0x7fff);   // 2.0 clamped down to +1.0
});

// ---------- edge cases ----------

function u16(bytes, off) {
  return bytes[off] | (bytes[off + 1] << 8);
}

test('mergeAndDownsample with no chunks returns an empty array', () => {
  const same = mergeAndDownsample([], 16000, 16000);
  assert.equal(same.length, 0);
  const down = mergeAndDownsample([], 48000, 16000);
  assert.equal(down.length, 0);
});

test('mergeAndDownsample with empty chunks mixed in still concatenates correctly', () => {
  const out = mergeAndDownsample(
    [new Float32Array(0), Float32Array.of(0.25), new Float32Array(0), Float32Array.of(0.75)],
    16000, 16000
  );
  assert.equal(out.length, 2);
  assert.ok(Math.abs(out[0] - 0.25) < 1e-6);
  assert.ok(Math.abs(out[1] - 0.75) < 1e-6);
});

test('mergeAndDownsample handles a non-integer ratio (44.1k -> 16k)', () => {
  const input = new Float32Array(44100).fill(0.3); // 1 second
  const out = mergeAndDownsample([input], 44100, 16000);
  const ratio = 44100 / 16000;
  assert.equal(out.length, Math.floor(input.length / ratio));
  // Constant signal survives box averaging regardless of window boundaries.
  for (const idx of [0, 100, out.length - 1]) {
    assert.ok(Math.abs(out[idx] - 0.3) < 1e-6, `sample ${idx}`);
  }
});

test('mergeAndDownsample output values stay within input range', () => {
  const noisy = new Float32Array(4800);
  for (let i = 0; i < noisy.length; i++) noisy[i] = Math.sin(i / 7); // values in [-1, 1]
  const out = mergeAndDownsample([noisy], 48000, 16000);
  for (let i = 0; i < out.length; i++) {
    assert.ok(out[i] >= -1 && out[i] <= 1, `sample ${i} out of range: ${out[i]}`);
  }
});

test('encodeWav of zero samples is a bare 44-byte header with zero data size', () => {
  const wav = encodeWav(new Float32Array(0), 16000);
  assert.equal(wav.length, 44);
  assert.equal(u32(wav, 40), 0, 'data chunk size');
  assert.equal(u32(wav, 4), 36, 'RIFF size = 36 + 0');
});

test('encodeWav header declares mono 16-bit PCM with consistent rates', () => {
  const rate = 16000;
  const wav = encodeWav(new Float32Array(10), rate);
  assert.equal(u16(wav, 20), 1, 'audio format = PCM');
  assert.equal(u16(wav, 22), 1, 'channels = mono');
  assert.equal(u32(wav, 24), rate, 'sample rate');
  assert.equal(u32(wav, 28), rate * 2, 'byte rate = rate * blockAlign');
  assert.equal(u16(wav, 32), 2, 'block align = 2 bytes/frame');
  assert.equal(u16(wav, 34), 16, 'bits per sample');
});

test('encodeWav round-trips sample values within int16 quantization error', () => {
  const samples = Float32Array.of(0, 0.5, -0.5, 0.999, -0.999, 0.123, -0.321);
  const wav = encodeWav(samples, 16000);
  for (let i = 0; i < samples.length; i++) {
    const decoded = i16(wav, 44 + i * 2) / (samples[i] < 0 ? 0x8000 : 0x7fff);
    assert.ok(Math.abs(decoded - samples[i]) < 1e-4, `sample ${i}: ${decoded} vs ${samples[i]}`);
  }
});

test('encodeWav RIFF size field is consistent with total length', () => {
  const wav = encodeWav(new Float32Array(123), 16000);
  assert.equal(u32(wav, 4), wav.length - 8, 'RIFF chunk size = file size - 8');
});
