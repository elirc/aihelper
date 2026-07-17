# Documentation

Docs for **AI Call Assistant** — a Windows desktop app (Electron) that records call
audio on demand, transcribes it with SiliconFlow SenseVoice, and streams an
AI-suggested answer from DeepSeek, grounded in your resume and the job description.

For product setup and the build command, see the [root README](../README.md).

## Index

| Doc | Read it when… |
|-----|---------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | You want the data flow, the IPC/preload contract, and where state lives. |
| [ONBOARDING.md](./ONBOARDING.md) | You're new to the codebase and want to make your first contribution. Start here. |
| [CODE_REVIEW.md](./CODE_REVIEW.md) | You want the current health check — what's solid, what's risky, and the prioritized backlog of improvements and UX issues. |
| [TESTING.md](./TESTING.md) | You're writing or running tests, or want to understand what's covered and why. |
| [ALTERNATIVE_APP_SPEC.md](./ALTERNATIVE_APP_SPEC.md) | You want the full codebase review and an implementation-ready specification for a distinct, free, local-first alternative. |

## 30-second architecture

```
Renderer (src/renderer)                 Main process (src/main)
────────────────────────                ───────────────────────
Record button                           IPC handlers (ipc.js)
  → system-audio loopback capture         → stt.js   → SiliconFlow SenseVoice
  → 16 kHz mono WAV (audio.js)            → llm.js   → DeepSeek (streaming, sse.js)
  → window.api.ask(wav)  ───IPC──────▶    → prompt.js builds the system prompt
  ◀── transcript + streamed answer ───     → store.js persists settings
```

The renderer never sees your API keys — all network calls happen in the main
process. See [ONBOARDING.md](./ONBOARDING.md) for the full tour.
