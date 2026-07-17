# CueDeck: codebase review and alternative-app specification

Status: autonomous-build-ready product and technical specification  
Reviewed: 2026-07-10  
Source project: AI Call Assistant v1.0.0  
Working title: **CueDeck** (placeholder; perform a name/trademark check before release)

## 0. Fable autonomous-build contract

This section is the controlling implementation brief for Fable or any other coding agent. If a later section is ambiguous, follow this section first, then choose the simplest implementation that satisfies the acceptance criteria.

### 0.1 Authorized objective

Build CueDeck completely as a consent-based conversation practice and disclosed-assistance desktop application. The intended uses are mock interviews, rehearsal, accessibility support, and calls where the participants and applicable rules permit recording and AI assistance.

This is not a request to bypass a model, platform, employer, interviewer, proctoring, recording-consent, or screen-sharing safeguard. The product must not contain covert-recording or concealment features. If an implementation choice conflicts with this boundary, omit that choice and continue building the rest of the application.

### 0.2 Target location and preservation rule

- Create the new application under `cuedeck/` at the current repository root.
- Treat the existing `src/`, `test/`, and package files as a read-only reference implementation.
- Do not rewrite the original application to become CueDeck.
- Do not copy the old app name, visual identity, hardcoded provider choices, API keys, or screen-capture behavior.
- Generated installers, model weights, caches, coverage, and Playwright artifacts must be gitignored.

Expected top-level result:

```text
aihelper/
  cuedeck/                 # new application
  docs/
    ALTERNATIVE_APP_SPEC.md
  src/                     # untouched reference application
  test/                    # untouched reference tests
```

### 0.3 Execution rules

Fable must:

1. Implement phases 0–5 in order and continue past scaffolding until every software-controlled acceptance criterion passes.
2. Make reasonable engineering decisions without pausing for cosmetic preferences, API keys, local model availability, or optional hardware.
3. Use test doubles for provider and hardware-independent automated tests; never block the build waiting for a real credential.
4. Keep real Groq, Gemini, OpenRouter, Ollama, and local-STT adapters implemented behind the provider contracts.
5. Use the latest supported stable package versions available at build time and commit the npm lockfile.
6. Prefer maintained, documented packages. Do not add a dependency for logic that is trivial to implement and test locally.
7. Run formatting, linting, type checking, unit tests, integration tests, Electron E2E tests, production build, and Windows packaging before declaring completion.
8. Fix failures rather than weakening or deleting tests.
9. Leave no production `TODO`, empty handler, fake success response, disabled security control, or unimplemented button.
10. Document only genuinely hardware-dependent manual checks as remaining verification; do not treat them as missing application code.

### 0.4 Fixed implementation defaults

Use these decisions unless a current package/API incompatibility makes one impossible:

| Decision | Required default |
|---|---|
| Package manager | npm |
| Node baseline | Node.js 22 LTS or newer supported LTS |
| Target | Windows 10/11 x64 first |
| Desktop framework | current supported Electron stable |
| Build system | Electron Forge + Vite |
| UI | React + strict TypeScript |
| Validation | Zod at IPC, settings, and provider boundaries |
| Tests | Vitest + Playwright Electron E2E |
| Local STT | Transformers.js worker/utility process |
| Local LLM | Ollama localhost adapter |
| Default operating mode | local-only, no credential |
| History | disabled by default |
| Telemetry | none |
| Renderer security | sandboxed, context isolated, no Node integration |
| Recording activation | explicit visible user action only |
| Capture concealment | prohibited; do not call `setContentProtection` |

### 0.5 Required scripts

The new `cuedeck/package.json` must expose:

```json
{
  "scripts": {
    "dev": "start the Electron/Vite development app",
    "build": "create production bundles",
    "typecheck": "run TypeScript without emitting",
    "lint": "run ESLint",
    "format:check": "verify formatting",
    "test": "run unit tests",
    "test:integration": "run provider/IPC integration tests",
    "test:e2e": "run Electron Playwright tests",
    "make": "build Windows distributables",
    "check": "run format, lint, typecheck, unit, and integration checks"
  }
}
```

The values above describe behavior; use the correct commands for the chosen Forge/Vite configuration rather than copying the descriptive strings literally.

### 0.6 Mandatory deliverables

Fable's build is incomplete unless `cuedeck/` contains:

- the working coach, preferences, and onboarding windows;
- secure main/preload/renderer boundaries;
- AudioWorklet capture with a live level meter and silence detection;
- local STT model management, download UI, worker execution, progress, and cancellation;
- Ollama discovery, model selection, health check, and streaming generation;
- working Groq, Gemini, and OpenRouter free-tier adapters;
- encrypted optional cloud credentials and external-processing disclosures;
- profiles, response modes, transcript correction, regeneration, copy, clear, and compact mode;
- optional local history with retention/deletion/export;
- diagnostics with sensitive-data redaction;
- all schemas, migrations, structured errors, timeouts, AbortSignals, session IDs, and sequence handling described below;
- unit, integration, Electron E2E, and security regression tests;
- a Windows maker configuration, application icons/placeholders owned by the project, and packaging documentation;
- `README.md`, `PRIVACY.md`, `SECURITY.md`, `THIRD_PARTY_NOTICES.md`, and `.env.example` containing names only—never credentials;
- a final implementation report mapping each acceptance criterion to code/tests or a clearly identified manual Windows verification.

### 0.7 Non-blocking fallbacks

- **No Ollama installed:** implement and test against a local fake HTTP server, show the real onboarding/install guidance, and keep the production adapter functional.
- **No model downloaded:** test the model manager with a tiny fixture and mocked download server; keep the real download path implemented.
- **No API keys:** test cloud adapters with local fake servers and fixtures; provider settings must remain usable without keys.
- **No loopback audio in CI:** inject deterministic WAV fixtures below the capture boundary and test the real state/IPC/provider pipeline.
- **No Windows packaging environment:** complete Forge maker configuration and production bundles, then report the maker invocation as the only environment-dependent check. On Windows, the maker must actually be run.
- **A cloud model ID changed:** isolate IDs in a typed provider catalog, choose a currently documented free model, update its fixture, and do not redesign the adapter.
- **WebGPU unavailable:** use the CPU/WASM local STT path and retain capability detection for future acceleration.

These fallbacks authorize continued engineering work; they do not authorize replacing production behavior with mocks.

### 0.8 Safety and consent requirements

These requirements are non-optional:

- Display a recording indicator for the entire capture period; compact mode must retain it.
- Require a first-run acknowledgement that the user is responsible for participant consent and applicable rules.
- Do not capture automatically at startup, run hidden recording, or provide a way to suppress the active recording state.
- Do not implement screen-capture exclusion, anti-detection behavior, proctoring bypasses, or claims that the application is invisible.
- Describe live use as disclosed assistance only. Interview functionality is framed as rehearsal unless assistance is explicitly permitted.
- Generated responses must not invent qualifications, employment, achievements, or personal experience.
- Do not add autonomous speaking, voice cloning, impersonation, or automated participation.

### 0.9 Completion response expected from Fable

When the implementation is finished, Fable should report:

1. the path to the new app;
2. the implemented architecture and major choices;
3. commands run and pass/fail totals;
4. produced installer/artifact paths;
5. provider and local-model behavior verified with mocks versus real services;
6. any manual Windows/audio checks still required;
7. confirmation that no production placeholder or safety-sensitive concealment feature remains.

## 1. Executive decision

Build a Windows-first, privacy-first desktop conversation practice and disclosed-assistance coach with the same core technical loop:

1. capture a short segment of system audio,
2. transcribe it,
3. generate a concise first-person response grounded in the user's profile and call context,
4. stream the response into a compact always-available window for rehearsal or permitted assistance.

Do not make a pixel-for-pixel clone. Keep the successful interaction loop, but change the visual system, onboarding, provider architecture, state management, privacy model, and packaging foundation.

The successor's defining constraint is **zero mandatory spend**:

- The default path is fully local: local speech-to-text plus a local Ollama-compatible language model.
- No account, hosted backend, paid API, credit card, subscription, or per-token charge is required.
- Optional cloud adapters may use provider free tiers, but the UI must label those as quota-limited and subject to provider changes.
- The app must never silently fall back from local processing to a cloud provider.
- Paid model IDs and automatic billing are out of scope for the initial release.

Recommended stack: current supported Electron + TypeScript + React + Vite, packaged with Electron Forge. This stays in the JavaScript ecosystem while adding type safety, explicit process boundaries, a testable state machine, and a mature component model.

## 2. Review scope and verification

The review covered every project-controlled file: 21 source, test, package, and documentation files totaling about 1,130 lines, excluding `package-lock.json` and generated dependencies. It included:

- Electron window creation, permissions, IPC, persistence, capture, and packaging;
- the complete renderer markup, styling, audio pipeline, and UI state machine;
- SiliconFlow transcription and DeepSeek streaming integration;
- prompt construction and SSE parsing;
- all unit tests and project documentation;
- the installed dependency tree and an npm security audit;
- current official documentation for free/local provider alternatives.

Verification results:

- `npm test`: **17/17 tests pass**.
- `npm audit --omit=dev`: no production dependency advisories, because the packaged application has no normal runtime npm dependencies.
- Full `npm audit`: **6 high-severity dependency findings**, principally the old Electron and electron-builder toolchain.
- Installed versions: Electron 33.4.11 and electron-builder 24.13.3.
- A device-level visual/capture test was not possible in the embedded preview environment. Layout conclusions below come from the complete HTML/CSS and state-machine source. Actual Windows loopback capture and content-protection behavior still require the manual test matrix in section 20.

## 3. Existing application: what it does

### 3.1 Runtime flow

```text
User presses Record
        |
        v
Electron grants a display-media request with Windows loopback audio
        |
        v
Renderer captures Float32 audio through ScriptProcessorNode
        |
        v
Renderer downsamples to 16 kHz mono and creates a PCM WAV
        |
        v
Main process sends WAV to SiliconFlow SenseVoice
        |
        v
Transcript is emitted to the renderer
        |
        v
Main process sends transcript + resume + job description to DeepSeek
        |
        v
SSE deltas are forwarded to the renderer and appended to the answer
```

### 3.2 Existing process boundary

| Layer | Files | Responsibility |
|---|---|---|
| Electron main | `src/main/*` | window, capture grant, settings, API calls, prompt, streaming |
| Preload bridge | `src/preload.js` | exposes settings, ask, transcript, and answer events |
| Renderer | `src/renderer/*` | UI, recording state, audio processing, settings form |
| Tests | `test/*` | pure audio, prompt, and SSE behavior |

### 3.3 Existing UX

The application is a narrow 460 × 700 px dark window with:

- a status dot and settings button;
- one large red Record / Stop & Answer control;
- a recording timer;
- separate transcript and suggested-answer panels;
- a settings view for two API keys, resume, job description, and always-on-top.

The UI is intentionally minimal and the primary loop is easy to understand. The main weakness is that almost all feedback is textual: there is no level meter, explicit generating indicator inside the answer panel, copy action, cancellation action, provider status, quota status, or capture-source diagnostic.

## 4. What is worth preserving

1. **A two-action core loop.** Record, then stop. It is faster and more dependable than continuous listening for the first release.
2. **Network calls outside the ordinary renderer.** Provider calls belong in a privileged service layer, not UI components.
3. **Context isolation and narrow named IPC methods.** The current preload surface is small and understandable.
4. **Text rendering with `textContent`.** Model and transcript output are treated as text, not executable HTML.
5. **A restrictive Content Security Policy.** Retain and tighten it.
6. **Pure deterministic modules.** Audio conversion, prompt assembly, stream parsing, validation, and state transitions should stay independently testable.
7. **Streaming answer presentation.** Seeing useful text early is important during rehearsal or a permitted assisted conversation.
8. **A hard recording limit.** The current 120-second cap prevents accidental unlimited memory growth.
9. **Local profile grounding.** Resume/profile and role context are the main differentiator from a generic chatbot.

## 5. Findings in the existing codebase

### 5.1 Critical product-constraint mismatch

The current application is not actually free to operate. The README describes SiliconFlow as approximately free and DeepSeek as metered. Even very low API pricing fails the requirement that the replacement must remain free.

Decision: the new application's default mode must not depend on any cloud free tier. Local inference is the only defensible permanent zero-marginal-cost default.

### 5.2 High-priority security and privacy findings

#### A. Saved API keys are exposed back to the renderer

`src/main/ipc.js` returns `store.all()` for `settings:get`, `src/preload.js` exposes it as `getSettings()`, and `src/renderer/app.js` reads the result. This means the renderer can retrieve both stored keys. The documentation's statement that the renderer never sees API keys is incorrect.

Required successor behavior:

- secrets are write-only from the renderer after initial entry;
- public settings return only `hasCredential: true/false`, never the value;
- secret retrieval occurs only inside the relevant main/utility-process provider adapter;
- changing a secret requires explicit replacement or removal.

#### B. Chromium renderer sandbox is disabled

`src/main/main.js` explicitly sets `sandbox: false`. Context isolation and disabled Node integration still help, but the process does not receive Chromium's full renderer sandbox. Electron's security guidance recommends sandboxing renderers and validating IPC senders.

Required successor behavior: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, no remote module, no renderer subprocess access, and no unfiltered IPC primitive exposed through preload.

#### C. Old Electron/build toolchain has current advisories

The full dependency audit reports six high-severity findings. The installed Electron 33 line is affected by multiple advisories, and electron-builder 24 pulls vulnerable build-time packages. A clean runtime-only audit obscures these development and framework risks.

Required successor behavior:

- pin a currently supported stable Electron version at implementation time;
- use automated weekly dependency checks;
- fail CI on high/critical runtime or packaging advisories unless an explicit, expiring exception exists;
- upgrade Electron regularly because the packaged Chromium version is part of the security boundary.

#### D. API keys are stored in plaintext

`src/main/store.js` writes all settings to JSON under the Electron user-data directory. There is no OS-backed encryption.

Required successor behavior: use Electron `safeStorage` for optional cloud secrets, store ciphertext separately from public settings, and clearly state that local mode stores no provider key.

#### E. Capture permission is globally and automatically granted

`setDisplayMediaRequestHandler` grants the first screen source plus loopback audio without checking the requesting frame, application state, or a one-time user gesture token. A compromised local renderer could request capture outside the intended button flow.

Required successor behavior:

- arm a one-use capture grant in the main process only after a validated `capture:arm` IPC request;
- validate the sender URL and top frame;
- expire the grant after a few seconds;
- deny all unarmed requests;
- return audio only where supported, or the smallest disposable video source only when required by the Electron/OS combination.

#### F. “Always hidden from screen sharing” is an unsafe and unnecessary promise

The settings UI says the window is always hidden. `setContentProtection(true)` is best-effort and depends on Windows version, capture path, GPU, and calling application. It cannot protect against every screen recorder or a physical camera.

Required successor behavior: do not carry this feature forward. The successor must not call `setContentProtection`, advertise capture exclusion, or attempt to conceal its window. A visible recording state is required whenever capture is active.

### 5.3 Reliability findings

1. **No network timeouts.** Either external request can leave the UI in a busy state indefinitely.
2. **No cancellation chain.** There is no AbortSignal from the renderer through IPC to STT and answer generation.
3. **No request/session ID.** Transcript and answer events are global, so future concurrency or retries could mix output.
4. **No structured error contract.** The renderer strips an Electron-generated prefix from a string with a regular expression.
5. **SSE EOF edge case.** A final `data:` frame without a newline remains in the parser buffer and is never processed. The decoder is also not explicitly flushed.
6. **No retry policy.** Transient 429/5xx failures immediately terminate the flow; blindly retrying would also be wrong without idempotency and a cap.
7. **Synchronous settings I/O.** It is small today, but errors on write are not converted into user-facing recoverable failures.
8. **No provider health check.** Missing credentials are detected, but invalid keys, unreachable endpoints, missing local models, and exhausted quotas are discovered only after a recording.

### 5.4 Audio findings

1. `ScriptProcessorNode` is deprecated and runs on the audio/main rendering thread.
2. A video capture pipeline is requested and immediately stopped even though only audio is used.
3. There is no input-level meter or silence warning while recording.
4. The entire uncompressed clip is retained as many Float32 chunks, merged, copied, downsampled, and copied again. The 120-second cap keeps this bounded, but the pipeline creates avoidable peak memory.
5. The simple box-average resampler is adequate for a 48 kHz → 16 kHz prototype, but it is not a general high-quality resampler.
6. Channel/downmix behavior is implicit rather than asserted and tested with stereo inputs.
7. There is no preflight test that confirms loopback audio is actually non-silent on the user's device.

### 5.5 UI and accessibility findings

1. No Copy, Clear, Cancel, Retry, or Regenerate action.
2. No indication of provider, processing location, quota, or local-model readiness.
3. The answer panel has no explicit streaming/done affordance.
4. Settings replace the entire working view, so the user loses visual context.
5. API-key fields lack reveal/replacement/removal affordances.
6. Fixed typography and a narrow panel are difficult to scan during a call.
7. Status relies partly on a colored dot; color is not enough for accessible state communication.
8. No keyboard-first flow, focus treatment specification, screen-reader live regions, or reduced-motion behavior.
9. No saved answer styles such as concise, bullets, STAR, clarify, or follow-up.
10. No history policy or clear explanation of whether transcripts persist.

### 5.6 Testing and release findings

The existing 17 pure-function tests are useful and pass, but there is no coverage for:

- the IPC pipeline;
- credential redaction;
- provider HTTP behavior;
- cancellation, timeout, retry, or out-of-order events;
- the renderer state machine;
- Electron security preferences;
- first-run onboarding;
- packaging/install/upgrade/uninstall;
- real Windows audio capture across Zoom, Teams, Meet, and browser playback.

The build creates an unsigned one-click NSIS installer with no update strategy. A trusted Windows code-signing certificate is not free, so a genuinely zero-budget distribution must accept SmartScreen warnings or publish reproducible unpacked/installer artifacts with checksums and transparent instructions.

## 6. Alternative product definition

### 6.1 Product statement

CueDeck is a free desktop conversation-practice and disclosed-assistance coach that turns a short clip of consented audio into a concise, editable response card. It is designed to be transparent about recording, processing location, model readiness, and privacy.

### 6.2 Primary users

- job seekers practicing mock interviews or using assistance that the interviewer explicitly permits;
- sales, support, recruiting, and customer-success staff using disclosed response cues on permitted calls;
- users in accessibility scenarios who benefit from a live transcript and structured talking points;
- people who want a local alternative to subscription call assistants.

### 6.3 Goals

- reach a useful first response quickly after a clip ends;
- operate indefinitely without mandatory spend;
- keep audio, profile, and transcript local by default;
- make provider choice and privacy consequences understandable;
- remain useful on modest Windows hardware;
- be easy to extend with new OpenAI-compatible, Gemini-compatible, or local providers;
- keep recording and application state visible and avoid all invisibility, anti-detection, or capture-exclusion behavior.

### 6.4 Non-goals for v1

- continuous meeting recording or full meeting transcription;
- automated participation, voice cloning, or speaking on the user's behalf;
- a hosted account system, team admin console, or cloud database;
- macOS/Linux parity in the first release;
- calendar, email, CRM, or video-call platform integrations;
- automatic resume parsing from arbitrary document formats;
- paid-provider billing, subscriptions, or a marketplace;
- screen-capture concealment, anti-detection, or hidden recording;
- use in proctored or evaluated settings where outside assistance is prohibited;
- autonomous factual research during a live answer.

## 7. Free-operation policy

“Free” must be implemented as a product rule, not a marketing adjective.

### 7.1 Guaranteed-free mode

Local mode is the default and the only mode labeled **Always free**:

- Speech-to-text: a locally downloaded Whisper-compatible ONNX model executed with Transformers.js in a worker/utility boundary.
- Answer model: a user-selected local model exposed through Ollama's localhost API.
- Storage: local only.
- Hosting: none.
- Telemetry: none by default.
- Marginal usage cost: $0, excluding the user's computer and internet connection for initial downloads.

If Ollama is not installed, the app can still transcribe locally and allow manual copy, but answer generation remains unavailable until the user installs/configures a local compatible server.

### 7.2 Optional free-tier cloud mode

Cloud modes are labeled **Free tier; limits may change**. Each adapter must have a remote kill switch only if the project later operates a config service; in a no-backend v1, model IDs are versioned in the app and provider errors explain how to update.

Rules:

- never request a paid model ID in the default configuration;
- never ask for a credit card;
- never auto-upgrade a plan;
- never auto-fallback to a different provider;
- show external-processing disclosure before enabling a cloud adapter;
- show a provider-specific data-use link;
- allow immediate key deletion;
- make “local only” a permanent one-click mode.

### 7.3 Current provider options (verified 2026-07-10)

| Provider | Use | Free status | Decision |
|---|---|---|---|
| Local Transformers.js | STT | Runs on device after free model download | Default STT |
| Local Ollama API | LLM | Runs on device at `localhost:11434` | Default LLM |
| Groq | STT + LLM | Official free-plan limits exist for Whisper and several LLMs | Optional fast cloud preset |
| Gemini Developer API | Audio/STT + LLM | Certain Flash/Flash-Lite inputs and outputs are free within quota; free-tier content may be used to improve products | Optional single-vendor preset with prominent disclosure |
| OpenRouter | LLM | `:free` models and `openrouter/free`; typical free account limited to 50 requests/day and 20 RPM | Optional experimental LLM adapter |
| SiliconFlow + DeepSeek | STT + LLM | Not a permanent zero-cost guarantee | Do not use as the default |

Current official references:

- [Transformers.js WebGPU and Whisper example](https://huggingface.co/docs/transformers.js/guides/webgpu)
- [Transformers.js Node audio processing](https://huggingface.co/docs/transformers.js/guides/node-audio-processing)
- [Ollama local API](https://docs.ollama.com/api/introduction)
- [Ollama chat endpoint](https://docs.ollama.com/api/chat)
- [Groq free-plan rate limits](https://console.groq.com/docs/rate-limits)
- [Groq speech-to-text](https://console.groq.com/docs/speech-to-text)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini audio understanding](https://ai.google.dev/gemini-api/docs/audio)
- [OpenRouter free-model limits](https://openrouter.ai/docs/api/reference/limits/)
- [OpenRouter free-model router](https://openrouter.ai/docs/cookbook/get-started/free-models-router-playground)

## 8. Distinct design direction

### 8.1 Visual identity

Avoid the original's red-on-charcoal recorder aesthetic. Use a calm “studio console” design:

- background: deep ink/navy rather than neutral charcoal;
- primary accent: teal/cyan for ready and active states;
- caution: amber; error: coral;
- cards with subtle layered elevation rather than boxed panels with heavy borders;
- tabular timing and provider metrics in a compact status rail;
- large, highly legible answer type with adjustable size;
- motion limited to a quiet waveform and streaming caret, disabled by `prefers-reduced-motion`.

Suggested tokens:

```css
--canvas: #0b1020;
--surface-1: #11182b;
--surface-2: #17213a;
--line: #263452;
--text: #f2f6ff;
--muted: #9aa9c4;
--accent: #35d0ba;
--accent-strong: #14b8a6;
--warning: #f5b942;
--danger: #ff6b73;
```

All colors must pass WCAG 2.2 AA for their intended text/background use.

### 8.2 Window model

Use two windows instead of replacing the main view with settings:

1. **Coach window** — default 620 × 640, resizable to 440 × 360, optionally always on top.
2. **Preferences window** — 720 × 680, standard window chrome, not always on top.

Add a compact coach mode (approximately 520 × 220) that shows capture controls, a persistent recording indicator, one-line transcript, and the active answer card. Compact mode reduces visual clutter but never hides capture state.

### 8.3 Coach-window wireframe

```text
+----------------------------------------------------------+
| CueDeck       LOCAL • Ready            Compact   Settings|
|----------------------------------------------------------|
| [ Listen ]   00:00   ▂▃▅▂▁  System audio: healthy       |
|                                                          |
| HEARD                                                    |
| “Tell me about a time you handled a production issue.”   |
|                                                          |
| RESPONSE                                  [Copy] [Clear]  |
| 30 sec  •  Natural                                      |
| I’d start with an incident where...                      |
| • I coordinated...                                      |
| • I reduced...                                          |
|                                                          |
| [Shorter] [Bullets] [STAR] [Try again]                   |
|----------------------------------------------------------|
| Local Whisper  •  qwen… via Ollama  •  1.8 s             |
+----------------------------------------------------------+
```

### 8.4 Required states

The coach state must be explicit and visible in text:

```text
unconfigured
  -> checking
  -> ready
  -> arming_capture
  -> recording
  -> encoding
  -> transcribing
  -> generating
  -> complete

Any active state -> cancelling -> ready
Any active state -> failed -> ready/retry
```

Events from an obsolete `sessionId` must be ignored.

### 8.5 First-run flow

1. Consent and privacy explanation.
2. Choose processing mode:
   - Local / always free / private (recommended)
   - Cloud free tier / easier on older computers
3. Run a capability check: OS, available memory, WebGPU/CPU backend, Ollama reachability, audio-capture availability.
4. Download the local STT model with size, license, progress, cancel, checksum verification, and storage location.
5. Detect Ollama and list installed models through its tags endpoint.
6. Run a 5-second system-audio test with a live meter.
7. Add optional profile and role context.
8. Generate a test response before marking setup complete.

No API-key form should appear in the recommended local path.

## 9. Functional requirements

### 9.1 Capture and audio

- **CAP-01:** Recording begins only after an explicit button press or an explicitly enabled keyboard shortcut.
- **CAP-02:** The UI shows elapsed time, live RMS/peak level, capture source, and silence warning.
- **CAP-02A:** A persistent textual and visual recording indicator remains visible in normal and compact modes for the full capture period.
- **CAP-03:** Default maximum clip length is 90 seconds; configurable from 30–120 seconds.
- **CAP-04:** Stopping immediately transitions to encoding and disables duplicate stop actions.
- **CAP-05:** Cancel discards audio and produces no provider request.
- **CAP-06:** Starting a new session cancels the previous session and invalidates its events.
- **CAP-07:** Use an `AudioWorklet`, not `ScriptProcessorNode`.
- **CAP-08:** Downmix stereo deterministically, resample to the selected STT model's requirement, and encode WAV or FLAC as required.
- **CAP-09:** Audio bytes are released after transcription unless the user explicitly enabled local session history.
- **CAP-10:** If audio is silent for the entire clip, fail before invoking an LLM and offer the audio diagnostic.

### 9.2 Transcription

- **STT-01:** Local STT is the default provider.
- **STT-02:** Return transcript text plus optional language, segments, and confidence metadata.
- **STT-03:** Let the user correct the transcript before regeneration.
- **STT-04:** Support automatic language detection and an explicit language override.
- **STT-05:** Provider timeout and cancel behavior must be consistent.
- **STT-06:** The UI states whether audio stayed local or was sent to a named provider.
- **STT-07:** Cloud providers receive only the current clip, never historical audio.

### 9.3 Answer generation

- **LLM-01:** Stream content deltas whenever the provider supports streaming.
- **LLM-02:** Return a full answer even when streaming is unavailable.
- **LLM-03:** Supported response modes: Natural, Concise, Bullets, STAR, Clarifying question.
- **LLM-04:** Supported target lengths: 15 sec, 30 sec, 60 sec.
- **LLM-05:** Never invent profile facts. When context is insufficient, produce a safe generic structure or ask for a detail.
- **LLM-06:** Allow Shorter, More specific, Bullets, STAR, and Regenerate follow-ups without retranscribing.
- **LLM-07:** Copy uses plain text and confirms success accessibly.
- **LLM-08:** Display the provider/model actually used.
- **LLM-09:** No silent provider failover.

### 9.4 Profiles and context

- **CTX-01:** Support multiple named profiles, e.g. “Backend resume” and “Sales background.”
- **CTX-02:** Store profile and role text locally.
- **CTX-03:** Show character/token-size estimates and warn before context becomes excessive.
- **CTX-04:** Allow per-session notes such as company, interviewer, goals, and facts to emphasize.
- **CTX-05:** Treat transcript, profile, job description, and notes as untrusted data delimited from instructions.
- **CTX-06:** Offer a preview of exactly what context categories will be sent to cloud providers.

### 9.5 History

- **HIS-01:** History is off by default.
- **HIS-02:** When enabled, save transcript, answer, provider IDs, timings, and created time; do not save raw audio by default.
- **HIS-03:** Provide per-item delete, delete all, export JSON/Markdown, and retention period.
- **HIS-04:** Deletion is local and immediate.

### 9.6 Preferences and diagnostics

- **SET-01:** Separate public preferences from encrypted credentials.
- **SET-02:** Test each provider before saving it as active.
- **SET-03:** Show local model installed/loading/ready/error status.
- **SET-04:** Show model download progress and disk use.
- **SET-05:** Include a diagnostics page with app/Electron version, OS, audio capability, model status, and sanitized recent errors.
- **SET-06:** Diagnostics export must exclude transcript, profile, job description, and credentials unless the user explicitly selects them.

## 10. Technical stack

### 10.1 Core

| Area | Choice | Rationale |
|---|---|---|
| Desktop runtime | current supported Electron stable | proven Windows loopback integration; full JS ecosystem |
| Language | TypeScript with strict mode | prevents IPC/provider-shape drift |
| UI | React + Vite | componentized settings/onboarding/coach surfaces and fast development |
| Packaging | Electron Forge | current, conventional packaging with explicit makers |
| Validation | Zod | runtime validation at every IPC and provider boundary |
| State | pure reducer/state machine + React hooks | deterministic transitions without a large state dependency |
| Unit tests | Vitest | TypeScript/Vite-native test runner |
| Electron E2E | Playwright | exercise real windows, IPC, and packaged behavior |
| Formatting/lint | ESLint + Prettier | consistent JS/TS baseline |
| Local STT | `@huggingface/transformers` in a worker/utility boundary | free local Whisper-compatible inference |
| Local LLM | Ollama localhost HTTP API | free, model-agnostic local generation |
| Secret encryption | Electron `safeStorage` | OS-backed encryption without a native npm credential dependency |

Pin exact versions in the lockfile, but choose supported releases at implementation time rather than copying the versions in this project.

### 10.2 No application backend

The v1 architecture has no hosted server. This eliminates hosting cost, account management, server-side secret handling, and a large privacy surface. Optional cloud requests go directly from the Electron main/utility process to the selected provider.

## 11. Proposed architecture

```text
Sandboxed React renderer
  | fixed, typed preload API
  v
Electron main process
  |-- window/security policy
  |-- IPC validation and session coordinator
  |-- public settings repository
  |-- encrypted secret vault
  |-- provider registry
  |
  +--> Audio/ML worker: local STT
  |
  +--> localhost Ollama adapter: local LLM
  |
  +--> optional HTTPS adapters: Groq / Gemini / OpenRouter

All operations emit events tagged with sessionId and sequence number.
```

### 11.1 Process rules

- Renderer: display and user interaction only. No filesystem, secret read, shell, or arbitrary network access.
- Preload: fixed methods with narrow argument/return types. Do not expose `ipcRenderer`, generic `send`, event objects, or channel names.
- Main: validate sender, validate payload, coordinate lifecycle, store public settings/secrets, and enforce outbound allowlists.
- ML worker/utility: load local models away from the UI thread; report progress and accept cancellation.
- Provider adapter: one module per provider behind a common interface.

### 11.2 Suggested repository structure

```text
src/
  main/
    bootstrap.ts
    windows/
      coachWindow.ts
      preferencesWindow.ts
    security/
      csp.ts
      navigation.ts
      permissions.ts
      senderValidation.ts
    ipc/
      register.ts
      contracts.ts
      sessions.ts
      settings.ts
    settings/
      publicStore.ts
      secretVault.ts
      migrations.ts
    sessions/
      coordinator.ts
      errors.ts
      timings.ts
    providers/
      registry.ts
      contracts.ts
      stt/
        localWhisper.ts
        groqWhisper.ts
        geminiAudio.ts
      llm/
        ollama.ts
        groq.ts
        gemini.ts
        openRouter.ts
    workers/
      sttWorker.ts
  preload/
    index.ts
    types.d.ts
  renderer/
    app.tsx
    routes/
      Coach.tsx
      Onboarding.tsx
      Preferences.tsx
    components/
    features/
      capture/
      transcript/
      answer/
      profiles/
      providers/
    state/
      sessionMachine.ts
    audio/
      captureWorklet.ts
      resample.ts
      wav.ts
  shared/
    schemas.ts
    domain.ts
    constants.ts
test/
  unit/
  integration/
  e2e/
```

## 12. Provider contracts

Use capabilities, not provider-specific conditionals in UI code.

```ts
type ProcessingLocation = 'local' | 'cloud';

interface ProviderMeta {
  id: string;
  displayName: string;
  location: ProcessingLocation;
  freePolicy: 'always-free-local' | 'provider-free-tier';
  supportsAbort: boolean;
}

interface TranscriptResult {
  text: string;
  language?: string;
  durationMs?: number;
  segments?: Array<{ startMs: number; endMs: number; text: string }>;
}

interface SttProvider {
  meta: ProviderMeta;
  probe(signal: AbortSignal): Promise<ProviderProbe>;
  transcribe(input: {
    audio: Uint8Array;
    mimeType: 'audio/wav' | 'audio/flac';
    language?: string;
    signal: AbortSignal;
  }): Promise<TranscriptResult>;
}

interface AnswerDelta {
  text: string;
  sequence: number;
}

interface LlmProvider {
  meta: ProviderMeta;
  probe(signal: AbortSignal): Promise<ProviderProbe>;
  generate(input: AnswerRequest): AsyncIterable<AnswerDelta>;
}
```

`probe()` must distinguish: ready, missing credential, unreachable, missing model, quota limited, unsupported, and unknown failure.

### 12.1 Local STT adapter

MVP implementation:

- Transformers.js automatic-speech-recognition pipeline;
- CPU/WASM or supported Node runtime backend in a worker/utility process;
- a small multilingual Whisper-compatible model by default, selected only after checking its model-card license and redistribution terms;
- model download on demand, not hidden inside installer startup;
- store model files under a versioned app model directory;
- checksum a project-controlled manifest;
- expose download/loading/transcription progress;
- retain one warm model instance with an idle unload option.

Later optimization: a dedicated sandboxed WebGPU worker surface for supported GPUs. Keep CPU fallback because WebGPU availability varies.

### 12.2 Ollama adapter

- Base URL defaults to `http://127.0.0.1:11434` and may be changed only in advanced settings.
- Allow loopback hosts by default; require confirmation for non-loopback hosts because prompts/profile data would leave the device.
- Discover installed models dynamically; do not hardcode a model that may disappear.
- Stream newline-delimited JSON from `/api/chat`.
- Send `think: false` where supported so hidden reasoning is not displayed or needlessly generated.
- Set bounded context/output options appropriate for short spoken answers.
- Report load time separately from generation time.

### 12.3 Groq adapter

Initial free preset:

- STT: `whisper-large-v3-turbo`;
- LLM: a current free-plan text model discovered/updated with the release, initially a small low-latency model such as `llama-3.1-8b-instant` if still listed;
- parse and surface rate-limit headers;
- honor `Retry-After` once for 429 only when the user is still waiting and the delay is short;
- 25 MB free-tier upload cap is well above a 90-second 16 kHz mono WAV, but enforce a conservative client limit anyway.

### 12.4 Gemini adapter

- Use a currently free Flash/Flash-Lite model that officially accepts audio.
- Support a two-step transcript-then-answer path for consistent editing and answer modes.
- A later single-pass structured-output path may return transcript + answer together, but must not replace the auditable two-step path until quality tests pass.
- Show that free-tier content may be used to improve provider products, per the current pricing disclosure.

### 12.5 OpenRouter adapter

- Use `openrouter/free` or a model ID that ends in `:free`.
- Fetch current model metadata when the user opens provider settings, with a cached fallback.
- Reject any model whose current pricing is not zero.
- Explain that free models have low quotas and availability can vary.
- Never route resume/profile content to a random free provider without explicit user consent to the free router's variable routing.

## 13. IPC contract

Every request and event uses Zod validation and a trusted sender check.

### 13.1 Renderer-to-main methods

```text
app:getCapabilities() -> AppCapabilities
settings:getPublic() -> PublicSettings
settings:updatePublic(patch) -> PublicSettings
secrets:set({ providerId, value }) -> { hasCredential: true }
secrets:remove({ providerId }) -> { hasCredential: false }
providers:list() -> ProviderSummary[]
providers:probe({ providerId }) -> ProviderProbe
models:list({ providerId }) -> ModelSummary[]
models:download({ modelId }) -> operationId
capture:arm({ sessionId }) -> { expiresAt }
session:submit({ sessionId, wav, options }) -> accepted
session:regenerate({ sessionId, transcript, options }) -> accepted
session:cancel({ sessionId }) -> cancelled
history:list(query) -> HistorySummary[]
history:delete({ id }) -> deleted
history:clear() -> cleared
```

### 13.2 Main-to-renderer events

Use one subscription method that strips the Electron event object:

```ts
type SessionEvent =
  | { type: 'state'; sessionId: string; state: SessionState }
  | { type: 'transcript'; sessionId: string; text: string }
  | { type: 'answer-delta'; sessionId: string; sequence: number; text: string }
  | { type: 'answer-complete'; sessionId: string; text: string; metrics: Metrics }
  | { type: 'progress'; sessionId: string; stage: string; value?: number }
  | { type: 'error'; sessionId: string; error: PublicError };
```

The preload subscription must return an unsubscribe function. No listener should survive a window teardown unintentionally.

### 13.3 Audio transfer

Use transferable `ArrayBuffer`/`MessagePort` where Electron supports it to avoid unnecessary copies. Validate:

- actual byte type;
- minimum and maximum byte length;
- RIFF/WAV header or selected format signature;
- sample rate/channel count/duration bounds;
- session ID format.

## 14. Session coordinator

The main process owns the authoritative session lifecycle.

```ts
interface SessionContext {
  id: string;
  controller: AbortController;
  state: SessionState;
  transcript?: string;
  answer: string;
  nextSequence: number;
  createdAt: number;
}
```

Rules:

1. At most one active capture/generation session in v1.
2. Creating a new session aborts and retires the old one.
3. All events include the originating session ID.
4. Renderer ignores retired session IDs and non-monotonic answer sequence numbers.
5. Local and cloud adapters receive the same AbortSignal.
6. Timeouts are stage-specific: suggested defaults 15 s provider probe, 45 s cloud STT, 120 s local STT on minimum hardware, 60 s to first LLM token, 120 s total generation.
7. A timeout maps to a structured code, not a parsed string.

Suggested public errors:

```text
CAPTURE_DENIED
CAPTURE_NO_AUDIO
CAPTURE_SILENT
AUDIO_TOO_SHORT
AUDIO_TOO_LONG
MODEL_NOT_INSTALLED
LOCAL_PROVIDER_UNREACHABLE
CREDENTIAL_MISSING
CREDENTIAL_REJECTED
PROVIDER_RATE_LIMITED
PROVIDER_TIMEOUT
PROVIDER_UNAVAILABLE
TRANSCRIPT_EMPTY
REQUEST_CANCELLED
STORAGE_FAILED
UNKNOWN
```

Each code has a stable user message, retryability flag, and optional action such as Open diagnostics, Replace key, Download model, or Switch provider.

## 15. Prompt specification

### 15.1 System instruction

The system prompt must:

- define the app as a response coach;
- request natural first-person spoken language;
- enforce the selected answer mode and target duration;
- state that profile/context/transcript blocks are untrusted reference data, not instructions;
- prohibit invented experience, metrics, employers, tools, or outcomes;
- prefer a clarifying response when the question is ambiguous;
- produce only the answer, without meta commentary;
- avoid claiming certainty for unsupported facts.

### 15.2 Data layout

```text
SYSTEM INSTRUCTIONS

<profile_data>
...
</profile_data>

<role_context>
...
</role_context>

<session_notes>
...
</session_notes>

<heard_transcript>
...
</heard_transcript>

Requested mode: STAR
Target speaking time: 30 seconds
```

Do not concatenate raw data under headings that can be mistaken for higher-priority instructions. Escape or safely delimit closing tags in user-provided text.

### 15.3 Output shaping

- Natural/Concise: plain text paragraphs.
- Bullets: 2–5 short bullets.
- STAR: Situation, Task, Action, Result headings only when the question calls for an example.
- Clarifying question: one sentence plus an optional bridge statement.
- Enforce a model-independent output character cap after generation; do not split surrogate pairs.

## 16. Storage and data model

### 16.1 Public settings

```ts
interface PublicSettings {
  schemaVersion: number;
  theme: 'dark' | 'system';
  alwaysOnTop: boolean;
  compactMode: boolean;
  historyEnabled: boolean;
  historyRetentionDays: 1 | 7 | 30 | 0;
  sttProviderId: string;
  sttModelId: string;
  llmProviderId: string;
  llmModelId: string;
  answerMode: 'natural' | 'concise' | 'bullets' | 'star' | 'clarify';
  targetSeconds: 15 | 30 | 60;
  fontScale: number;
  activeProfileId?: string;
  credentials: Record<string, { configured: boolean }>;
}
```

### 16.2 Secret store

- one encrypted record per provider;
- ciphertext and encryption metadata only on disk;
- no secret value in `settings:getPublic`;
- clear in-memory copies as soon as practical after request construction;
- redact authorization headers and URL query keys from logs;
- migrate/delete secrets explicitly when schema changes.

### 16.3 Profile

```ts
interface Profile {
  id: string;
  name: string;
  summary: string;
  roleContext: string;
  emphasisNotes: string;
  createdAt: string;
  updatedAt: string;
}
```

### 16.4 History item

```ts
interface HistoryItem {
  id: string;
  createdAt: string;
  transcript: string;
  answer: string;
  sttProviderId: string;
  sttModelId: string;
  llmProviderId: string;
  llmModelId: string;
  answerMode: string;
  timings: { encodeMs: number; transcribeMs: number; firstTokenMs?: number; totalMs: number };
}
```

Raw audio is not part of this schema in v1.

## 17. Security requirements

These are release gates, not backlog polish.

1. Current supported Electron stable; no known high/critical unaccepted advisories.
2. `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`.
3. Custom `app://` protocol instead of ordinary `file://` where practical.
4. CSP starts from `default-src 'none'`; add only required self resources and explicit provider/model download hosts in the privileged process, not renderer wildcard access.
5. Deny navigation away from the app origin.
6. Deny window creation by default.
7. `shell.openExternal` accepts only parsed HTTPS URLs from a hardcoded allowlist.
8. Validate IPC sender frame and origin for every privileged method.
9. Validate every IPC argument and provider response.
10. One-use, expiring capture grant tied to a session ID.
11. No generic IPC method or arbitrary filesystem path accepted from the renderer.
12. Encrypt optional cloud credentials with `safeStorage`.
13. Redact secrets and sensitive context from logs.
14. No remote code, remote renderer pages, `eval`, or unsafe inline script.
15. Review and set Electron fuses during packaging.
16. Generate checksums for release artifacts and local model manifests.
17. Show a recording-consent and permitted-use acknowledgement on first run and keep a link in preferences.
18. Do not call `setContentProtection` or implement any screen-capture exclusion, hidden-recording, or anti-detection behavior.
19. Keep an active recording indicator visible and test that compact mode cannot suppress it.

Electron security references:

- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron process sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [Electron context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)

## 18. Performance targets

Targets should be measured on a published minimum machine and a reference machine.

Suggested minimum: Windows 10/11 64-bit, 4-core CPU, 8 GB RAM, 2 GB free disk. Local LLM quality/speed depends heavily on hardware and model size, so onboarding must benchmark rather than promise a universal speed.

| Metric | Target |
|---|---|
| Cold app launch to interactive | ≤ 3 s on reference machine |
| Record button response | ≤ 100 ms |
| Level-meter update | 10–20 Hz without UI jank |
| Encoding 60 s clip | ≤ 1 s reference machine |
| Cloud STT 30 s clip | median ≤ 3 s on normal broadband |
| Local STT 30 s clip | benchmark and show estimate; target ≤ 10 s reference machine |
| Cloud answer first token | median ≤ 2 s after transcript |
| Local answer first token | target ≤ 5 s with recommended small local model after warmup |
| Streaming render | maintain 60 fps; batch deltas per animation frame |
| Idle coach memory | target < 250 MB excluding loaded model workers |

Do not hide model-loading latency. Display “Loading local model” separately and keep the model warm for a configurable period.

## 19. Accessibility requirements

- Full keyboard operation with visible focus.
- Space/Enter controls Listen only when the button is focused; avoid a surprising global shortcut by default.
- Optional global shortcut must be opt-in, configurable, and conflict-checked.
- Use ARIA live regions for state and completed answer, but do not announce every streaming token.
- Provide text labels in addition to color/status dots.
- Font scaling from 90% to 160% without clipped controls.
- High-contrast focus and error states.
- Reduced-motion support.
- Copy success and errors announced to assistive technology.
- No focus loss when stream content updates.
- Minimum 44 × 44 CSS px primary touch targets.

## 20. Test strategy

### 20.1 Unit tests

- WAV/FLAC headers, stereo downmix, resampling, clipping, silence detection.
- Session reducer transitions, including invalid/out-of-order events.
- Prompt construction, delimiter escaping, empty-context behavior, answer-mode rules.
- NDJSON/SSE parsing across arbitrary chunk splits and EOF without newline.
- Provider response normalization and public error mapping.
- Zod schemas and secret redaction.
- retention-date calculation and settings migrations.

Retain and port the current 17 pure tests rather than discarding them.

### 20.2 Integration tests

Use dependency injection and local fake servers:

- WAV -> fake STT -> transcript event -> fake LLM -> ordered deltas -> complete.
- STT timeout, abort, 401, 429, 500, malformed JSON, empty transcript.
- LLM stream split at every byte boundary, missing newline at EOF, disconnect mid-stream.
- new session aborts old session and old deltas are ignored.
- `settings:getPublic` never contains credential text.
- provider allowlist blocks an unexpected host.
- capture request without an armed grant is denied.

### 20.3 Electron E2E tests

- first run opens onboarding;
- local/cloud choice updates disclosure correctly;
- preferences open in a separate window;
- record state transitions and cancel flow;
- transcript edit and regenerate;
- copy/clear/compact/font-scale behavior;
- provider failure recovery;
- navigation and untrusted `window.open` are blocked;
- renderer cannot access Node primitives or raw IPC.

### 20.4 Manual Windows matrix

Test Windows 10 and 11 where supported, with:

- Chrome/Edge YouTube playback;
- Google Meet in browser;
- Zoom desktop;
- Microsoft Teams desktop;
- headphones, speakers, Bluetooth headset, USB audio;
- 44.1 kHz and 48 kHz output devices;
- silent playback, device switch during recording, sleep/resume;
- recording indicator remains visible throughout capture in normal/compact modes and after resize/minimize/restore transitions;
- minimum hardware and a GPU-capable reference machine;
- offline local mode after models are downloaded.

### 20.5 Release checks

- clean install, upgrade, uninstall while preserving user data unless selected;
- model downloads resume/cancel correctly;
- no credential/profile/transcript in logs or crash output;
- npm audit/security review;
- installer and unpacked artifact checksums;
- VirusTotal/manual antivirus false-positive check where policy permits;
- license/notice inventory for app dependencies and redistributed model assets.

## 21. Delivery plan

### Phase 0 — foundation and security (2–3 developer days)

- scaffold Electron Forge + Vite + React + strict TypeScript;
- create coach/preferences windows;
- implement CSP, sandbox, navigation denial, URL allowlist, Electron fuses;
- define shared Zod IPC contracts and public error type;
- configure Vitest, Playwright, lint, formatting, and CI.

Exit gate: a packaged shell opens, security assertions pass, and the renderer has no raw Electron/Node access.

### Phase 1 — capture and local transcription (4–6 days)

- implement one-use capture grant;
- implement AudioWorklet capture, meter, silence detection, duration limit, deterministic downmix/resample/WAV;
- implement local model manager and STT worker;
- build onboarding capability/model-download steps;
- show editable transcript and structured errors.

Exit gate: offline system audio can be recorded and transcribed on reference Windows hardware with cancel and silence handling.

### Phase 2 — local answer generation (3–5 days)

- implement Ollama detection, model discovery, health check, and streaming adapter;
- implement prompt builder, answer modes, target durations, profile grounding;
- implement session coordinator, IDs, cancellation, sequencing, timeouts;
- add response card, copy, clear, regenerate, and timing metrics.

Exit gate: full offline record -> transcript -> streamed answer flow works with no account or API key.

### Phase 3 — product UX and persistence (3–5 days)

- profiles and role context;
- separate preferences window;
- compact mode, font scaling, keyboard and accessibility pass;
- optional local history and retention controls;
- diagnostics and sanitized export;
- persistent recording indicator, consent/permitted-use disclosure, and compact-mode visibility checks.

Exit gate: all MVP functional/accessibility acceptance criteria pass.

### Phase 4 — cloud free-tier adapters; required to build, optional for users (4–6 days)

- encrypted secret vault;
- Groq STT + LLM preset;
- Gemini adapter;
- OpenRouter free-only adapter;
- external-processing consent, provider data-use links, quota/rate-limit UI;
- HTTP fake-server integration suite.

Exit gate: each provider passes probe, success, timeout, cancel, auth, quota, and malformed-response tests; local remains default.

### Phase 5 — hardening and release (3–5 days)

- full Windows manual matrix;
- dependency and license review;
- installer, checksums, clean install/upgrade/uninstall tests;
- performance profiling and delta batching;
- README, privacy model, consent guidance, support/diagnostics guide;
- GitHub Release workflow for an open-source public repository.

Exit gate: release checklist is complete with no unresolved P0/P1 defect.

Total initial estimate: roughly 19–30 focused developer days for a polished Windows v1, depending primarily on local-model download/runtime behavior and the breadth of the Windows capture matrix.

## 22. MVP acceptance criteria

The MVP is done only when all statements below are true:

1. A new user can choose Local mode and complete setup without an account, API key, credit card, or payment.
2. After models are downloaded, the full flow works with the network disconnected.
3. System audio capture shows a live meter and warns on silence.
4. A 5–90 second clip produces an editable transcript or a specific recoverable error.
5. A local Ollama model streams an answer grounded in the selected profile.
6. Starting over or cancelling prevents every obsolete delta from appearing.
7. Copy, Clear, Regenerate, Shorter, Bullets, and STAR actions work.
8. Public settings and diagnostics never expose saved credentials.
9. Renderer sandboxing, context isolation, navigation denial, sender validation, and payload validation are enabled and tested.
10. Raw audio is deleted from memory/storage after transcription unless a future explicit audio-history feature is enabled.
11. History is off by default.
12. The app does not use screen-capture exclusion or hidden recording, and the recording indicator cannot be suppressed while capture is active.
13. All unit/integration/E2E suites pass.
14. The installer works on supported Windows versions, and release artifacts have published checksums.
15. The repository includes license notices for code dependencies and local model artifacts.

## 23. Post-MVP backlog

- macOS audio-capture research and implementation;
- continuous rolling transcription with voice activity detection;
- microphone + system-audio mixing with explicit consent;
- user-defined prompt templates with safe preview;
- a bundled llama.cpp provider to remove the separate Ollama prerequisite;
- WebGPU STT optimization and model benchmarking;
- multilingual answer output independent of transcript language;
- local semantic retrieval across multiple profile/context documents;
- signed releases if funding becomes available;
- opt-in, privacy-preserving crash reporting;
- import resume/job description from PDF/DOCX after local text-extraction review.

## 24. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---:|---|
| Local inference too slow on low-end hardware | High | High | benchmark onboarding, recommend smaller models, optional free cloud mode |
| Ollama setup is too much friction | Medium | High | guided detection/install instructions; later bundled llama.cpp adapter |
| Windows loopback behavior changes by Electron/OS version | Medium | High | pin/test Electron, maintain manual capture matrix, feature probe |
| Cloud free tiers change | High | Medium | local default, capability probes, config-driven IDs, honest labels |
| Free-tier data-use terms conflict with user expectations | Medium | High | per-provider disclosure and explicit opt-in; local one-click fallback |
| Model license/redistribution issue | Medium | High | download on demand, capture model-card license, release notice review |
| Unsigned installer triggers SmartScreen | High | Medium | checksums, reproducible releases, transparent docs; signing requires funding |
| User attempts prohibited or non-consensual use | Medium | High | first-run acknowledgement, visible recording state, no concealment features, clear permitted-use policy |
| Profile prompt causes fabricated claims | Medium | High | prompt constraints, evaluation set, concise modes, explicit “insufficient context” behavior |
| Renderer compromise escalates through IPC | Low after controls | High | sandbox, narrow preload, sender/payload validation, capture token, no generic IPC |

## 25. Quality evaluation set

Before choosing default local and cloud models, create a versioned evaluation set with synthetic/non-sensitive profiles and at least:

- 20 straightforward mock-interview questions;
- 20 behavioral rehearsal questions requiring profile grounding;
- 10 ambiguous or non-question transcripts;
- 10 noisy/partial transcripts;
- 10 malicious prompt-injection-like transcript/profile inputs;
- 10 cases where the profile lacks the requested experience;
- multiple accents/languages for STT.

Score:

- transcription word accuracy;
- time to transcript;
- time to first answer token and total time;
- factual grounding/no invented experience;
- natural spoken quality;
- adherence to answer mode and target duration;
- correct refusal to follow instructions embedded in transcript data.

The default model slug must be a release configuration selected from these results, not a permanent constant buried in provider code.

## 26. Final recommendation

The original application is a good prototype: small, readable, direct, and backed by useful pure-function tests. It proves the capture -> transcription -> streamed response loop with very little code.

It should not be used as the production foundation without addressing its product-cost mismatch, renderer-accessible secrets, disabled sandbox, old Electron toolchain, unconditional capture grant, plaintext keys, missing cancellation/timeouts, and unsafe screen-share concealment claim. The successor intentionally removes concealment rather than renaming or weakening that feature.

Build CueDeck as a new TypeScript project and port only the proven pure behaviors and interaction lessons. Make local inference the product, not a fallback. Treat cloud free tiers as optional convenience adapters. That produces a genuinely different app with a defensible free promise, clearer privacy, stronger reliability, and an architecture that can support changing model providers without rewiring the UI.
