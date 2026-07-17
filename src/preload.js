const { contextBridge, ipcRenderer } = require('electron');

// Minimal, explicit bridge between the page and the main process.
// Only these five functions are reachable from the page; ipcRenderer itself
// (and any Node primitive) is never exposed. Event payloads are coerced to
// strings so main-process data crosses the bridge as plain values.

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (obj) => ipcRenderer.invoke('settings:set', obj),
  ask: (wavArrayBuffer) => ipcRenderer.invoke('ask', wavArrayBuffer),
  onTranscript: (cb) => {
    if (typeof cb !== 'function') throw new TypeError('onTranscript expects a function');
    ipcRenderer.on('transcript', (_e, text) => cb(String(text)));
  },
  onAnswerChunk: (cb) => {
    if (typeof cb !== 'function') throw new TypeError('onAnswerChunk expects a function');
    ipcRenderer.on('answer-chunk', (_e, chunk) => cb(String(chunk)));
  }
});
