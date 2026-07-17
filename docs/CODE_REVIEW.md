# Code review & improvement backlog

A full pass over the codebase as of v1.0.0. Findings are grouped by area and each
carries a rough severity: **P1** (fix before real use), **P2** (should fix soon),
**P3** (nice to have / polish). Nothing here is currently blocking the app from
running — it boots, the pipeline is wired correctly, and the pure logic is tested.

## What's solid

- **Clean process split.** Keys and all `fetch` calls live in the main process;
  the renderer is sandboxed (`contextIsolation: true`, `nodeIntegration: false`)
  and reaches main only through a small `contextBridge` surface in `preload.js`.
  This is the right security posture for an app that holds user API keys.
- **No injection surface.** Transcript and answer text are written with
  `.textContent`, and `index.html` sets a restrictive CSP (`default-src 'self'`).
  External text can't execute.
- **Pure logic is isolated and tested.** `audio.js`, `sse.js`, and `prompt.js`
  are dependency-free and covered by `npm test` (17 cases).
- **The hard Electron bits are correct:** system-audio loopback via
  `setDisplayMediaRequestHandler`, screen-share hiding via
  `setContentProtection(true)`, and streaming SSE parsing that survives chunk
  boundary splits.

## Correctness & robustness

- **P2 — No timeout on network calls.** `stt.js` and `llm.js` call `fetch` with no
  `AbortController`. If SiliconFlow or DeepSeek hangs, the UI sits on "Working…"
  forever. Add a timeout (e.g. 30s for STT, 60s for the stream) and surface a
  friendly error. `generateAnswer` should also accept an `AbortSignal`.
- **P2 — Recording again doesn't cancel the in-flight answer.** If the user records
  a new question while the previous DeepSeek stream is still arriving, both write to
  `answerBox`. Track the current request and abort it when a new `ask` starts.
- **P2 — `getDisplayMedia` requests a video track we immediately throw away.**
  `app.js` asks for `{ video: true, audio: true }` and stops the video track right
  after. That spins up a screen-capture pipeline for nothing (CPU/GPU cost). Try
  `{ video: false, audio: true }`; if the loopback handler rejects that on your
  Electron version, request the smallest possible video and document why.
- **P3 — `ScriptProcessorNode` is deprecated.** It works in current Chromium but
  runs on the main thread and can glitch under load. Migrate to an `AudioWorklet`
  for capture when convenient. Isolate this so `audio.js`'s pure helpers stay
  unchanged.
- **P3 — Fragile error-message cleanup.** `app.js#showError` strips the
  `"Error invoking remote method 'ask':"` prefix with a regex. If Electron changes
  that wording it silently stops matching. Prefer sending a structured
  `{ code, message }` from the main process instead of parsing strings.
- **P3 — `store.js` writes synchronously on the main thread** and caches in memory.
  Fine at this scale, but a corrupt `settings.json` throws on write; wrap saves and
  warn the user rather than crashing.

## Security & privacy

- **P2 — API keys stored in plaintext.** `settings.json` in `%APPDATA%` holds both
  keys unencrypted. Acceptable for a local single-user tool, but worth either using
  the OS credential vault (e.g. `keytar`) or at least documenting the tradeoff in
  the UI so users aren't surprised.
- **P3 — No consent / legal affordance.** Recording calls is regulated in many
  jurisdictions. The README notes this; consider a one-time in-app acknowledgement.
- **P1 (product, not code) — "hidden from screen share" is not a guarantee.**
  `setContentProtection` relies on OS/GPU support and specific Windows builds; some
  capture paths (or a phone camera pointed at the screen) still see the window.
  Make sure the UI never implies it's undetectable.

## UX issues

- **P2 — No feedback that audio is actually being captured.** During recording the
  user sees a timer but no signal that sound is coming through. A silent clip only
  reveals itself after they stop and get "No speech detected." Add a live
  input-level meter so problems show up immediately.
- **P2 — Can't copy the answer.** The whole point is to read/paraphrase the answer
  fast; there's no Copy button and selecting streaming text is awkward. Add
  **Copy answer** (and optionally auto-select on stream end).
- **P2 — No clear "done vs still generating" state.** The status text changes but
  the answer panel gives no end-of-stream cue. Add a subtle spinner/caret that stops
  when the stream closes.
- **P3 — No reset.** Between questions the previous transcript/answer lingers. A
  small **Clear** control (or auto-clear on new recording) would reduce confusion.
- **P3 — Fixed, small font.** Reading a paragraph in a narrow always-on-top window
  is cramped. A font-size control (A− / A+) would help a lot during a live call.
- **P3 — API-key fields have no reveal toggle.** Users can't verify what they pasted.
  Add an eye toggle on the two password inputs.
- **P3 — No keyboard trigger.** The user opted out of *global* hotkeys, but an
  in-app Space/Enter to start-stop recording (when the window is focused) is cheap
  and safe.
- **P3 — Long answers push the layout.** The answer panel scrolls, which is fine,
  but a very long generation can bury the transcript. Consider a collapsible
  transcript once an answer arrives.

## Testing gaps

Covered today: WAV encoding, downsampling, SSE parsing, prompt building. Not yet
covered (see [TESTING.md](./TESTING.md) for the plan):

- **P2 — `ipc.js` pipeline** with `stt`/`llm` mocked (transcript event fires,
  empty-transcript path throws, chunks forwarded).
- **P3 — `store.js`** round-trip and default handling (needs the Electron `app`
  path stubbed or injected).
- **P3 — A renderer smoke test** (jsdom or Playwright/Electron) for the record
  state machine, since that logic is currently untested.

## Suggested order of work

1. Network timeouts + abort on re-record (P2, correctness).
2. Copy button + generating indicator + input-level meter (P2, the UX that makes
   the app usable live).
3. `video: false` capture experiment (P2, performance).
4. IPC pipeline tests (P2).
5. Everything remaining P3 as polish.
