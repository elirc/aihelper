// Pure audio helpers, shared between the renderer and the test suite.
// UMD-style: attaches to `window.AudioUtil` in the browser/renderer (no module
// system there, since nodeIntegration is off) and exports for `require` in Node.
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.AudioUtil = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  // Concatenate captured Float32 chunks and resample to `toRate`.
  // Uses box averaging over each output window as a cheap anti-alias filter.
  function mergeAndDownsample(chunkList, fromRate, toRate) {
    let total = 0;
    for (const c of chunkList) total += c.length;
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of chunkList) { merged.set(c, off); off += c.length; }

    if (fromRate === toRate) return merged;
    const ratio = fromRate / toRate;
    const outLen = Math.floor(merged.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(Math.floor((i + 1) * ratio), merged.length);
      let sum = 0;
      for (let j = start; j < end; j++) sum += merged[j];
      out[i] = end > start ? sum / (end - start) : 0;
    }
    return out;
  }

  // Encode mono Float32 samples in [-1, 1] as a 16-bit PCM WAV (Uint8Array).
  function encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);            // PCM
    view.setUint16(22, 1, true);            // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let off = 44;
    for (let i = 0; i < samples.length; i++, off += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Uint8Array(buffer);
  }

  return { mergeAndDownsample, encodeWav };
});
