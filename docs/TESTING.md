# Testing

## How to run

```bash
npm test
```

That runs Node's built-in test runner (`node --test`) over the `test/` folder.
**No dependencies, no API keys, no network, no Electron** — the suite only touches
pure functions, so it's fast (~1s) and safe to run anywhere, including CI.

Current status: **17 tests, all passing**, across three files.

## Why these tests (and why this way)

The app's risk is concentrated in a few pieces of fiddly, deterministic logic that
sit between the user's audio and the two paid APIs. Those pieces are exactly the
kind of code that breaks silently and is annoying to debug through a live call. So
before adding tests, the tricky logic was **extracted into pure modules** with no
Electron or network dependency:

| Module | Extracted from | Why it's worth testing |
|--------|----------------|------------------------|
| `src/renderer/audio.js` | inline functions in `app.js` | Binary WAV encoding and resampling are easy to get subtly wrong (endianness, header sizes, int16 clamping, off-by-one in the downsample window). A wrong byte here means SenseVoice silently returns garbage. |
| `src/main/sse.js` | inline loop in `llm.js` | Streaming SSE arrives in arbitrary network chunks; a `data:` line can split across two reads. This is a classic source of dropped/duplicated tokens. |
| `src/main/prompt.js` | `buildSystemPrompt` in `llm.js` | The prompt is the product. Its behavior (include resume/JD only when present, add the grounding clause) should be locked so a refactor can't quietly change answer quality. |

This is the pattern to follow for new logic: **push the deterministic part into a
pure function, then test that function.** It keeps tests fast and keeps the
Electron/network glue thin enough to verify by hand.

## What each file covers

### `test/audio.test.js` (5 cases)
- Chunk concatenation when input and output rates match.
- Correct length at a 2:1 downsample ratio, and that a constant signal stays
  constant through box averaging.
- 48 kHz → 16 kHz produces ~1/3 length and averages each window correctly
  (verified against a hand-computed ramp).
- WAV header is valid: `RIFF`/`WAVE`/`fmt `/`data` tags, sample-rate field, and
  data-chunk size.
- Samples quantize to int16 with full-scale positive/negative, and out-of-range
  values (e.g. `2.0`) clamp to `+1.0`.

### `test/sse.test.js` (6 cases)
- Extracts content deltas from complete lines.
- **Carries a partial trailing line forward** — the split-chunk case that motivated
  extracting this module.
- Ignores the `[DONE]` sentinel.
- Skips keep-alive comments and blank lines.
- Tolerates malformed JSON without throwing (a bad keep-alive shouldn't kill the
  stream).
- Drops deltas with no `content` (e.g. the role-only opening frame).

### `test/prompt.test.js` (6 cases)
- Always includes the assistant-role and first-person instructions.
- Omits resume/JD sections **and** the grounding clause when the profile is empty.
- Embeds the resume / the JD when each is provided.
- Includes both sections plus the grounding clause when both are set.
- Treats whitespace-only input as empty (trims before deciding).

## What's intentionally not covered yet

These need mocking or a browser/Electron harness, so they're deferred (tracked in
[CODE_REVIEW.md](./CODE_REVIEW.md)):

- **`ipc.js` pipeline** — needs `stt`/`llm` mocked to assert the transcript event
  fires, the empty-transcript path throws, and answer chunks are forwarded.
- **`stt.js` / `llm.js` network layer** — HTTP mocking (status handling, 401
  messaging, streaming assembly against a fake `fetch`).
- **`store.js`** — file round-trip; needs the Electron `app` userData path stubbed.
- **Renderer state machine (`app.js`)** — the idle → recording → processing
  transitions; needs jsdom or an Electron/Playwright smoke test.

## Adding a test

1. Put the file in `test/` named `*.test.js`.
2. Use the standard library only:
   ```js
   const { test } = require('node:test');
   const assert = require('node:assert/strict');
   ```
3. Import the pure module under test with `require('../src/...')`.
4. Run `npm test`. Keep the suite dependency-free and offline.
