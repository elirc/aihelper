# AI Call Assistant

A Windows desktop app (Electron) that helps you answer questions during your own live calls and interviews.

Press **Record** while the other person is speaking; the app captures your PC's system audio (whatever the call app is playing), transcribes it with **SiliconFlow SenseVoice**, and streams a tailored answer from **DeepSeek** — grounded in your resume and the job description you paste into Settings.

> **Important — legal and ethical use.** This tool assists *you* during *your own* calls. Recording a call may require the consent of all parties depending on your jurisdiction; some contexts (e.g. proctored assessments, employer policies) may prohibit AI assistance entirely. You are responsible for complying with the laws and rules that apply to you.

## Features

- **Push-to-record** — nothing is captured until you press the button; press again to stop and get an answer.
- **System-audio capture** — hears any call app (Zoom, Teams, Meet, browser) via Windows loopback; no virtual audio cables needed.
- **Hidden from screen share** — the window is excluded from screen captures and recordings (Windows 10 2004+).
- **Tailored answers** — paste your resume and the target job description in Settings; every answer is grounded in them.
- **Streaming** — answers appear word-by-word as they are generated.
- **Zero runtime npm dependencies** — Electron and electron-builder are the only (dev) dependencies.

## Setup

Requires Node.js 20+ and Windows (the audio-loopback and screen-hide features are Windows-specific).

```bash
npm install
npm start
```

On first run, click the **gear icon** and add:

| Setting | Where to get it |
|---|---|
| **SiliconFlow API key** | <https://cloud.siliconflow.com/account/ak> — transcription (SenseVoice, ~free) |
| **DeepSeek API key** | <https://platform.deepseek.com/api_keys> — answers (~$0.27/M input tokens) |
| **Resume** + **Job description** | plain text; used to ground every answer |

Settings are saved by the main process as plain JSON to
`%APPDATA%\AI Call Assistant\settings.json` (Electron's `userData` directory — see `src/main/store.js`). There is no environment-variable or `.env` mechanism; the Settings screen is the only way keys enter the app, and they never leave your machine except in `Authorization` headers to the two APIs.

## Usage

1. Join your call. Make sure the call audio plays through this PC's speakers/headphones.
2. Press **Record** while the other person is asking their question.
3. Press **Stop & Answer**. The transcript appears, then the suggested answer streams in.
4. Press **Record** again for the next question. Clips are capped at 120 seconds.

## Architecture

Two Electron worlds, joined by a small IPC surface (full walkthrough in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):

```
src/
  main/               Node.js main process — owns keys, network, window
    main.js           window creation, loopback grant, content protection
    ipc.js            IPC handlers; orchestrates the ask pipeline
    store.js          settings persistence (settings.json in userData)
    stt.js            SiliconFlow SenseVoice transcription
    llm.js            DeepSeek streaming chat completion
    sse.js            pure SSE-chunk parser (tested)
    prompt.js         pure system-prompt builder (tested)
  preload.js          contextBridge — the only door between the worlds
  renderer/           sandboxed Chromium UI
    app.js            record/stop state machine, settings screen
    audio.js          pure WAV encode + downsample helpers (tested)
test/                 Node built-in test runner; pure functions only
```

API keys and all `fetch` calls live in the main process; the renderer is context-isolated (`nodeIntegration: false`) and reaches main only through the `window.api` bridge in `preload.js`.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Launch the app (Electron). |
| `npm test` | Run the test suite (`node --test`). No network, no keys, no Electron needed. |
| `npm run syntax` | Parse-check every source file with `node --check` (fast, dependency-free). |
| `npm run dist` | Build the Windows NSIS installer via electron-builder → `dist/AI Call Assistant Setup 1.0.0.exe`. |

## Troubleshooting

- **"Could not capture system audio"** — the app records *system output* (loopback), not your microphone. Make sure the call's audio is actually playing on this PC (not on a headset routed through another device) and that sound output works. If Windows blocks capture, check *Settings → Privacy & security → Screen capture / Microphone* app permissions.
- **"No speech detected in the recording"** — the clip reached the transcriber but contained silence. Record *while* the other person is speaking, and check your Windows output volume isn't muted.
- **"Recording was too short"** — hold Record for at least a fraction of a second of real audio; press Record before the question starts.
- **"… API key is not set"** — open Settings (gear icon) and paste the SiliconFlow and/or DeepSeek key. Both are required.
- **401 errors** — the provider rejected your key; re-copy it (no surrounding spaces) into Settings.
- **Stuck on "Working…"** — a provider request is hanging; restart the app and try again (network timeouts are being hardened).
- **The window shows up in a screen share** — content protection requires Windows 10 2004 or newer; older Windows versions cannot hide it.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — data flow, IPC contract, where state lives.
- [docs/ONBOARDING.md](docs/ONBOARDING.md) — first-contribution tour of the codebase.
- [docs/TESTING.md](docs/TESTING.md) — what's tested and the pattern for testing new logic.
- [docs/CODE_REVIEW.md](docs/CODE_REVIEW.md) — health check and prioritized improvement backlog.
- [rewrite.md](rewrite.md) — the v2 proposal (streaming STT + faster LLM) and its latency analysis.

## License

MIT
