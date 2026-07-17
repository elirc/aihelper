# Rewrite proposal: AI Call Assistant v2

Goal: **minimize time from "stop recording" to "first useful words on screen"**, keep per-question cost trivially cheap. Paid APIs are fine when they buy real latency.

Reviewed: 2026-07-10, against v1.0.0 (`src/`, `test/`, `docs/`).

---

## 1. Review of the current app

### What v1 does well

- **Right interaction model.** Push-to-record → transcript → streamed answer is the correct loop for live-call assistance. Keep it.
- **Right process split.** API keys and `fetch` live in the Electron main process; the renderer is context-isolated and only sees a narrow `contextBridge` surface. Output rendered via `textContent` + strict CSP — no injection surface.
- **The hard Windows bits work.** System-audio loopback via `setDisplayMediaRequestHandler(... audio: 'loopback')` with no virtual cables, and `setContentProtection(true)` for screen-share hiding. This is the app's moat — most frameworks can't do this in 10 lines.
- **Pure logic is isolated and tested.** `audio.js`, `sse.js`, `prompt.js` are dependency-free with 17 passing tests.
- **Zero runtime npm dependencies.** Small attack/maintenance surface.

### Where the latency actually goes

The pipeline is strictly serial, and every stage waits for the previous one to fully finish:

```
user stops recording
  → merge + downsample + WAV-encode full clip          (~50–300 ms, CPU)
  → upload whole WAV to SiliconFlow, wait for text     (~1–4 s; batch STT + far-away servers)
  → POST to DeepSeek, wait for first SSE token         (~1–5 s TTFT; deepseek-chat is cheap but
                                                        has high and highly variable TTFT,
                                                        especially at US/EU peak hours)
  → tokens stream in                                   (moderate tok/s)
```

**Typical stop-to-first-word today: ~3–8 seconds.** In a live interview that's an eternity. The structural problem: **STT does nothing while the user is recording** — the 10–60 seconds of speaking time is wasted, then the whole clip is transcribed after the fact.

Secondary latency/robustness issues (most already flagged in `docs/CODE_REVIEW.md`):

| Issue | Effect |
|---|---|
| Batch STT after stop | STT cost paid *after* stop instead of *during* recording |
| No connection pre-warming | TLS + handshake to both providers on every question |
| No prompt caching | Resume + JD (often 1–3K tokens) reprocessed at full price every question |
| No timeouts / AbortController | A hung provider freezes the UI on "Working…" forever |
| No request/session IDs | Re-recording while an answer streams interleaves two answers into one box |
| `ScriptProcessorNode` (deprecated) | Main-thread audio; can glitch under load |
| Requests a video track it immediately discards | Spins up a capture pipeline for nothing |
| Whole clip buffered as Float32 chunks, merged, copied, downsampled | Avoidable peak memory; encode happens on the UI thread |

### Cost review

Current costs are already near-zero (SenseVoice ~free, DeepSeek ~$0.27/M input). **Cost is not the problem — latency is.** A realistic mock-interview hour (20 questions, ~30s audio each, ~2K input / 400 output tokens per answer) costs pennies on *any* mainstream provider. That frees the rewrite to pick providers purely on speed.

---

## 2. Framework: keep Electron, rewrite the pipeline

Evaluated options:

| Option | Verdict |
|---|---|
| **Electron + TypeScript + Vite** (recommended) | Loopback audio capture and content protection already proven here. Latency is network/pipeline-bound, not framework-bound — swapping frameworks buys ~0 ms where it matters. |
| Tauri v2 + Rust (WASAPI loopback via `cpal`/`wasapi`) | ~10× smaller binary, lower idle RAM. But you'd re-solve loopback capture, screen-hide, and packaging in Rust for zero latency win. Only worth it if binary size/RAM becomes a real complaint. |
| Web app / PWA | Can't capture system audio without a screen-picker prompt each time; can't hide from screen share. Dead on arrival. |
| Native Win32 / .NET | Best possible footprint, slowest to build, loses the JS test suite and ecosystem. Not justified. |

**Decision: Electron 36+ (current stable), TypeScript strict, Vite + electron-builder (or Forge), vanilla or Preact renderer.** The UI is two panels and a button — React is optional; strict TS is not.

The win comes from re-architecting *when work happens*, not what it runs on.

---

## 3. The core change: overlap work with speaking time

### v2 pipeline

```
app start        pre-connect STT WebSocket (keep-alive), pre-warm LLM prompt cache
record pressed   AudioWorklet → 16 kHz PCM frames → stream over WS as the user speaks
while recording  partial transcript renders live (user sees it's hearing correctly ← fixes
                 the "silent clip discovered too late" UX bug for free)
stop pressed     send finalize; streaming STT flushes final transcript in ~100–300 ms
                 → LLM request fires immediately (system prompt served from cache)
answer           first tokens in ~300–800 ms, streamed sentence-by-sentence
```

Transcription now happens **in parallel with the question being asked**. At stop, the transcript is already ~done. The stop-to-first-word budget becomes: STT finalize (~0.2s) + LLM TTFT (~0.3–0.8s on a fast provider) ≈ **0.5–1.2 s**, versus 3–8 s today. That is the entire rewrite in one sentence; everything else is supporting detail.

### Provider selection

**STT — pick a streaming-first provider:**

| Provider | Mode | Latency | Price (verify before building — third-party prices as of my last data) |
|---|---|---|---|
| **Deepgram Nova-3 (recommended)** | WebSocket streaming | ~200–300 ms partials, fast finalize | ~$0.46/hr of audio (~$0.0077/min) |
| AssemblyAI Universal-Streaming | WebSocket streaming | ~300 ms | ~$0.15/hr |
| Groq Whisper large-v3-turbo | Batch (but extremely fast) | ~1s for a 30s clip | ~$0.04/hr |
| Keep SiliconFlow SenseVoice | Batch | 1–4 s | ~free |

Deepgram or AssemblyAI: real streaming, purpose-built for this. Groq Whisper is the fallback if you want to keep the simpler batch architecture — it alone would cut STT from ~1–4 s to ~1 s, but it can't overlap with speaking time.

**LLM — pick for TTFT and tokens/sec; all options are cheap at this usage level:**

| Provider / model | Why | Price per MTok in/out |
|---|---|---|
| **Claude Haiku 4.5 (recommended)** | Fast, strong instruction-following for the "answer as me, grounded in my resume" task; prompt caching cuts the repeated resume+JD to ~0.1× on cache reads | $1 / $5 (current, confirmed) |
| Groq (Llama 3.3 70B / gpt-oss) | Fastest TTFT + tok/s in the industry; quality slightly below Haiku for nuanced grounding | ~$0.59 / $0.79 (verify) |
| Gemini 2.5 Flash / Flash-Lite | Fast, cheap, generous free tier | ~$0.30 / $2.50, Lite lower (verify) |
| Keep DeepSeek | Cheapest, but TTFT is the single biggest latency liability in v1 | $0.27 / ~$1.10 |

Recommendation: **Claude Haiku 4.5 primary, Groq as a user-selectable "fastest" preset.** Answer quality is what the user reads aloud in an interview — worth $5/M output tokens (≈ $0.002 per answer). If Anthropic, use `cache_control` on the system prompt (resume + JD); note Haiku 4.5's minimum cacheable prefix is 4096 tokens, so short resumes won't hit cache — pad the stable prefix or just accept full price, it's still ~$0.002/question.

Worst-case cost with the recommended stack: an hour of heavy use (60 min streamed audio + 20 answers) ≈ **$0.46 (STT) + $0.05 (LLM) ≈ $0.51/hour**. Cost is a rounding error; the design should never trade latency to save it.

**Architecture B (considered, not recommended):** send the WAV directly to a multimodal model (e.g. Gemini Flash audio-in) — one API call, no STT service. Rejected because it forfeits the overlap trick (audio can only upload after stop), loses the live transcript, and couples you to one vendor. Streaming STT + text LLM is strictly better for push-to-record.

---

## 4. Target architecture

```
src/
  main/
    main.ts             window, loopback grant (audio-only, one-shot armed per session)
    ipc.ts              zod-validated handlers; every event tagged { sessionId, seq }
    stt/
      deepgram.ts       WS client: connect, keepalive, sendPcm, finalize, AbortSignal
    llm/
      provider.ts       common interface: generate(req, onDelta, signal)
      anthropic.ts      Haiku 4.5 + prompt caching (official SDK)
      groq.ts           OpenAI-compatible streaming
    prompt.ts           (port of v1 — keep, already tested)
    store.ts            settings; secrets encrypted with Electron safeStorage
    session.ts          one active session; new session aborts old (fixes interleaving)
  preload.ts            typed bridge, unsubscribe functions
  renderer/
    app.ts              state machine: idle → recording → finalizing → answering
    audio-worklet.ts    capture + downsample to 16 kHz Int16 frames (replaces ScriptProcessorNode)
    ui/                 live transcript, level meter, streamed answer, copy button
test/                   port the 17 existing tests + session/abort/stt-framing tests
```

Key mechanics:

- **Session IDs + AbortController end-to-end.** Record-again cancels the in-flight STT finalize and LLM stream; stale deltas are dropped by ID. Fixes v1's two-answers-in-one-box bug and the hang-forever bug in one design.
- **Timeouts per stage** (5s STT finalize, 10s LLM first token, 60s total) with structured `{code, message}` errors — no more regex-stripping Electron's error prefix.
- **AudioWorklet emits 16 kHz Int16 frames directly** — no giant Float32 buffer, no post-hoc downsample, no WAV encode at all (streaming STT takes raw PCM). v1's `audio.js` survives only in tests / as a batch-STT fallback.
- **Audio-only capture.** Try `getDisplayMedia({ video: false, audio: true })` under the loopback handler; keep the discarded-video workaround only if the Electron version demands it.
- **Pre-warm on record-press, not app start** (STT WS connect takes ~100 ms; connecting at app start wastes keep-alive traffic). Open the WS the instant the button is pressed — it's ready before the first speech frame.
- **Keys in `safeStorage`**, never returned to the renderer (`settings:get` returns `hasKey: true` flags only) — closes the v1 leak where `store.all()` handed both keys to the renderer.
- **Keep**: prompt builder (+ tests), SSE parser (still needed for Groq; Anthropic SDK handles its own streaming), the two-button UX, always-on-top compact window, content protection, settings surface (now: STT key, LLM key, provider picker, resume, JD).

### Latency budget (stop → first word)

| Stage | v1 | v2 |
|---|---|---|
| Encode clip | 50–300 ms | 0 (streamed during recording) |
| STT | 1–4 s | 100–300 ms (finalize only) |
| LLM first token | 1–5 s | 300–800 ms |
| **Total** | **~3–8 s** | **~0.5–1.2 s** |

---

## 5. Migration plan

Incremental — each phase ships a working app:

1. **TypeScript + Vite scaffold; port v1 as-is.** Port the 17 tests. No behavior change.
2. **Reliability layer.** Session IDs, AbortController, timeouts, structured errors, safeStorage. (Kills the worst v1 bugs before touching providers.)
3. **Swap LLM.** Provider interface + Anthropic Haiku 4.5 (with caching) + Groq preset. Biggest latency win per line of code — TTFT drops even with batch STT still in place.
4. **Streaming STT.** AudioWorklet → Deepgram WS, live transcript + level meter. This is the structural win.
5. **Polish.** Copy button, done/generating indicator, clear-on-new-recording, font sizing.

Phases 1–3 are roughly a weekend; phase 4 is the real project (a few days including the Windows audio test matrix from `docs/`).

---

## 6. Summary

| | v1 | v2 |
|---|---|---|
| Stop → first word | 3–8 s | 0.5–1.2 s |
| Cost / hour of use | ~$0.01 | ~$0.50 |
| Framework | Electron + vanilla JS | Electron + strict TS + Vite (keep the moat, harden the code) |
| STT | SiliconFlow batch, after stop | Deepgram streaming, during recording |
| LLM | DeepSeek (slow TTFT) | Claude Haiku 4.5 (+cache) / Groq preset |
| Robustness | no timeouts, no cancel, key leak to renderer | sessions, aborts, timeouts, safeStorage |

You pay ~50¢/hour instead of ~1¢ and the answer starts appearing before the interviewer finishes drawing breath. That's the trade the goal statement asked for.

> Note: Anthropic prices above are current as of this review; third-party prices (Deepgram, AssemblyAI, Groq, Gemini) are from my last known data and marked "verify" — confirm on their pricing pages before committing, as streaming-STT pricing in particular changes often.
