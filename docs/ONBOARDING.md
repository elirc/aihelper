# Onboarding: contributing to AI Call Assistant

Welcome! This guide gets you from "just cloned it" to "shipped my first change"
without needing anyone to explain the codebase in person. Read it top to bottom
once; after that it's a reference.

## 1. What the app does

The user is on a live call or interview. They press **Record** while the other
person is talking, press **Stop & Answer**, and the app:

1. captures the audio the *call app* is playing (system audio, not the mic),
2. transcribes that clip to text,
3. asks an LLM for the answer the user should give — grounded in their resume and
   the target job description,
4. streams that answer into the window, word by word.

Two external paid APIs do the heavy lifting: **SiliconFlow SenseVoice** for
speech-to-text and **DeepSeek** for the answer. Everything else is local.

## 2. The mental model: two worlds

Electron apps have two kinds of code, and knowing which world you're in explains
almost every "why is it structured like this" question.

- **Main process** (`src/main/`) — a Node.js process. Has the filesystem, the
  network, and the OS window. This is where API keys live and where all `fetch`
  calls happen.
- **Renderer** (`src/renderer/`) — a Chromium page (HTML/CSS/JS). This is the UI.
  It is deliberately sandboxed: `nodeIntegration: false` and
  `contextIsolation: true` mean the renderer **cannot** use `require`, touch the
  disk, or read the API keys.

The two talk only through a narrow, explicit bridge:

```
renderer  →  window.api.*  (preload.js)  →  ipcMain handlers (ipc.js)  →  main
```

`src/preload.js` is the *only* thing exposed to the page (via `contextBridge`).
If the UI needs something from the main process, you add a method there — you
never punch a hole in the sandbox.

> **Why it matters:** keeping keys and network in the main process is the whole
> security story. A bug in the UI (or a malicious script injected into rendered
> text) still can't read the user's DeepSeek key. Don't move `fetch` or key
> access into the renderer.

## 3. File-by-file tour

```
src/
├─ main/                 ← Node world
│  ├─ main.js            App entry. Creates the window, enables screen-share
│  │                     hiding (setContentProtection), routes getDisplayMedia
│  │                     to Windows system-audio loopback.
│  ├─ ipc.js             The bridge's server side. One handler, `ask`, runs the
│  │                     whole pipeline: transcribe → generate → stream back.
│  ├─ stt.js             SiliconFlow SenseVoice client (WAV in → transcript out).
│  ├─ llm.js             DeepSeek client. Streams the completion.
│  ├─ prompt.js          Pure: builds the system prompt from resume + JD.
│  ├─ sse.js             Pure: parses the SSE stream DeepSeek returns.
│  └─ store.js           Tiny JSON settings store in %APPDATA%.
├─ preload.js            The bridge's client side. Defines window.api.
└─ renderer/             ← Browser world
   ├─ index.html         Markup for the main view + settings view.
   ├─ styles.css         Compact dark theme.
   ├─ audio.js           Pure: mergeAndDownsample + encodeWav (16 kHz mono WAV).
   └─ app.js             All UI behavior: capture, record state machine, wiring.
```

The four files marked **Pure** (`prompt.js`, `sse.js`, `audio.js`, and the merge
logic) have no Electron or network dependency. That's on purpose — pure functions
are the parts we unit-test (see [TESTING.md](./TESTING.md)). When you add logic,
prefer pushing the tricky part into a pure function you can test in isolation.

## 4. Trace one request end to end

Follow a single recording through the code — this is the fastest way to "get" it:

1. **User clicks Record.** `recordBtn` handler in `app.js` calls `startRecording()`.
2. `startRecording` calls `navigator.mediaDevices.getDisplayMedia({ audio: true })`.
   In `main.js`, `setDisplayMediaRequestHandler` intercepts this and answers with
   `audio: 'loopback'`, so we get system audio with no screen-picker popup.
3. Audio is captured through a `ScriptProcessorNode` into an array of Float32
   chunks (`chunks`).
4. **User clicks Stop & Answer.** `stopRecording()` runs
   `AudioUtil.mergeAndDownsample` (→ 16 kHz mono) then `AudioUtil.encodeWav`
   (→ a WAV byte buffer), and calls `window.api.ask(wav.buffer)`.
5. That IPC lands in `ipc.js`'s `ask` handler. It calls `transcribe()` (`stt.js`),
   emits a `transcript` event to the UI, then calls `generateAnswer()` (`llm.js`).
6. `generateAnswer` opens a streaming DeepSeek request. Each network chunk goes
   through `parseSSEChunk` (`sse.js`); every content delta is sent to the UI as an
   `answer-chunk` event.
7. `app.js`'s `onTranscript` / `onAnswerChunk` handlers paint the transcript and
   append answer text as it arrives.

## 5. Local setup

```bash
npm install          # installs Electron + electron-builder (~100 MB, one time)
npm start            # launches the app
npm test             # runs the unit tests (node --test, no extra deps)
npm run dist         # builds the Windows installer into dist/
```

To exercise the full pipeline you need two API keys (gear icon → Settings):

- SiliconFlow: <https://cloud.siliconflow.com/account/ak>
- DeepSeek: <https://platform.deepseek.com/api_keys>

No keys yet? You can still work on and test all the pure logic and the UI shell —
`npm test` needs no keys or network.

## 6. How to make a change (worked examples)

**"Add a Copy button for the answer."** Pure renderer change: add the button in
`index.html`, style it in `styles.css`, and in `app.js` wire a click handler that
copies `answerBox.textContent`. No main-process or IPC change needed.

**"Support a second answer model."** Main-process change. Add a setting in the
settings view + `store`, read it in `llm.js`, and branch the request. Keep the
network call in `llm.js`; don't leak it to the renderer.

**"Change how the prompt is built."** Edit `src/main/prompt.js` only, then update
`test/prompt.test.js` to lock in the new behavior. Because it's a pure function,
you can iterate with `npm test` in a tight loop — no need to launch Electron.

## 7. Conventions & gotchas

- **Never render untrusted text with `innerHTML`.** The transcript and answer come
  from external services; we always use `.textContent` (see `app.js`). Keep it that
  way — it's our XSS guard, backed by the CSP in `index.html`.
- **Keys and `fetch` stay in `src/main/`.** If you're typing `fetch` in the
  renderer, stop and add an IPC method instead.
- **Add new IPC in two places, together:** expose it in `preload.js` and handle it
  in `ipc.js`. They're a pair.
- **Pure logic → its own module + a test.** That's how `audio.js`, `sse.js`, and
  `prompt.js` came to be. Follow the pattern.
- **`ScriptProcessorNode` is deprecated** but works today; see the migration note
  in [CODE_REVIEW.md](./CODE_REVIEW.md) before touching audio capture.
- **Windows-only features:** `setContentProtection` (screen-share hiding) and
  system-audio loopback are the reason this targets Windows. Don't assume macOS.

## 8. Good first issues

Pulled from [CODE_REVIEW.md](./CODE_REVIEW.md), roughly easiest first:

1. Add a **Copy answer** button.
2. Add a **Clear / reset** button for the two panels.
3. Show a small **"generating…"** indicator that ends when the stream completes.
4. Add a **live audio-level meter** while recording so users know capture works.
5. Add a **reveal (eye) toggle** on the API-key fields in Settings.

Pick one, open a branch, and run `npm test` before you push. Welcome aboard.
