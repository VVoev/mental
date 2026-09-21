# Architecture

Status: draft v1, 2026-09-18. Decisions behind this document are logged in
`../decision.log`. If this document and `decision.log` disagree, `decision.log`
is the record of what was decided and this document needs updating.

## 1. What this is

A web app where an adult user answers two onboarding questions (age, what they
want to think about) and then has a single conversation with an AI that acts as
a reflective interlocutor: it reflects, connects things said at different
times, names contradictions, and asks a question when it leads somewhere
(prompt v2, 2026-09-19 — not the pure question-only Socratic style of v1). It
never hands over conclusions, advice, or a diagnosis.

What it is not: therapy, a medical device, a diagnostic tool, or a product with
accounts and history. Those are deliberate exclusions, not missing features.

## 2. Constraints that shape everything below

1. **Nothing about a user is persisted.** No accounts, no database, no
   transcript storage, no logging of message content. This is the single
   biggest simplifier in the system and the main reason the backend is
   stateless.
2. **Adults only.** Under-18 is refused at onboarding and re-checked server side.
3. **The model must stay in role.** Method and crisis posture are defined in
   one prompt file, loaded from one place.
4. **The agent building this needs a verification loop.** Everything is testable
   without calling a real LLM.

## 3. Repository layout

```
mental-help/
├── CLAUDE.md                  # agent instructions, always loaded
├── decision.log               # append-only decision history
├── .claude/rules/             # path-scoped agent rules
├── docs/
│   ├── architecture.md        # this file
│   └── prompt/
│       └── system-prompt.md   # canonical AI system prompt (source of truth)
├── apps/
│   ├── web/                   # Vue 3 + TS + Pinia + Vite
│   └── api/                   # NestJS + TS
├── packages/
│   └── shared/                # request/response types shared by web and api
└── e2e/                       # Playwright, plain JavaScript
```

pnpm workspaces. `packages/shared` is the only cross-app dependency.

## 4. Request flow

```
Browser (Pinia holds full transcript)
   │
   │  POST /api/session/message
   │  { ageBand, presentingIssue, messages: [...] }   ← whole transcript, every time
   ▼
NestJS  SessionController
   │  → validate DTO (class-validator), enforce age gate, enforce size caps
   │  → SessionService builds: [system prompt] + [onboarding context] + [messages]
   │  → LlmProvider.stream(...)
   ▼
GroqProvider → Groq OpenAI-compatible endpoint (streaming)
   │
   ▼
SSE stream back to browser, appended token by token into the Pinia store
```

The server keeps nothing after the response ends. Two users, or the same user
twice, are indistinguishable to the backend.

Cost of this design: the full transcript travels on every turn, so token usage
grows quadratically over a long session. Mitigation is a message/character cap
enforced server side, and a soft nudge in the UI to close the session when it
gets long. Revisit if sessions turn out to run longer than expected.

## 5. Frontend (apps/web)

**Views**

| View | Responsibility |
| --- | --- |
| `OnboardingView` | age question → gate; then presenting issue; shows the disclaimer |
| `SessionView` | chat transcript, composer, streaming reply, crisis resources |
| `ClosingView` | end-of-session screen; no summary is stored anywhere |

**Stores**

- `useOnboardingStore` — age band, presenting issue. In memory.
- `useSessionStore` — messages, streaming state, error state. In memory.

In-memory means a refresh ends the session. That is the intended tradeoff of
the no-persistence decision, and the UI should warn before navigation rather
than quietly restoring from storage.

**API layer** — `src/api/session.ts` owns fetch + SSE parsing. Components never
call the API directly.

## 6. Backend (apps/api)

**Modules**

- `SessionModule` — controller, DTOs, `SessionService`, prompt assembly.
- `LlmModule` — `LlmProvider` interface, `GroqProvider`, `MockProvider`.
- `SpeechModule` — `SpeechProvider` interface; Groq Whisper STT +
  ElevenLabs TTS (`CompositeSpeechProvider`), or `MockSpeechProvider` when
  `MOCK_LLM=1`.
- `SafetyModule` — seam for a deterministic risk screen. Inert for now (see §8).
- `ConfigModule` — env validation at boot; the app refuses to start without a
  provider API key.

**Endpoints**

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/session/message` | SSE stream of the assistant reply |
| `POST` | `/api/session/transcribe` | multipart audio in, `{ text }` out (Groq Whisper) |
| `POST` | `/api/session/speak` | `{ text, voiceId? }` in, `audio/mpeg` out (ElevenLabs) |
| `GET` | `/api/session/voices` | `{ voices: [{ id, name }] }` from ElevenLabs account |
| `GET` | `/api/health` | liveness, no auth |

**Cross-cutting**

- `@nestjs/throttler` rate limits by IP. There are no accounts, so IP is the
  only lever against abuse.
- A global exception filter that guarantees no request body reaches the logs.
- CORS locked to the web origin.

## 7. LLM provider layer

```ts
interface LlmProvider {
  stream(req: LlmRequest): AsyncIterable<LlmChunk>
}
```

`GroqProvider` talks to Groq's OpenAI-compatible endpoint
(`https://api.groq.com/openai/v1`), so the official OpenAI SDK can be pointed at
it with a custom `baseURL` rather than pulling in a separate client.

The model id is configuration (`GROQ_MODEL`), not a constant in code. Groq's
catalogue changes; verify the current model list before wiring it and record the
chosen model in `decision.log`.

**Known risk, worth stating plainly.** Groq serves open-weight models. They are
fast and cheap, which is why they were chosen, but they are generally weaker
than frontier models at two things this product depends on: holding a strict
role over a long conversation (not sliding into advice-giving), and judging
nuanced crisis signals. The provider interface exists precisely so this can be
re-evaluated without a rewrite. Before any real users, run a fixed set of hard
conversations through the chosen model and read the transcripts by hand.

## 8. Safety layer

Current posture, per `decision.log`, is the soft approach and it is implemented
**in the prompt**, not in code. `SafetyModule` exists as a seam and does not
filter, block, or rewrite model output today.

The open question is whether prompt-level judgement is enough to catch concrete,
immediate risk, or whether a deterministic pre-screen (keyword and pattern based,
or a small classifier call) should run on the user's message before the main
call. That decision is not made yet. Until it is, do not half-implement it.

## 9. Testing and the verification loop

```
pnpm verify  =  lint  →  typecheck  →  unit  →  e2e (MOCK_LLM=1)
```

- **Unit** — prompt assembly, DTO validation, age gate, throttler config,
  SSE chunk parsing. Fast, no network.
- **E2E** — Playwright in plain JavaScript against the real web app and a real
  API process started with `MOCK_LLM=1`, where `MockProvider` replays fixtures
  from `e2e/fixtures/`.

`MOCK_LLM=1` is what makes this codebase safe to hand to a coding agent: the
whole user journey is verifiable, deterministic, and free. Tests never call Groq.

## 10. Configuration

| Var | Where | Notes |
| --- | --- | --- |
| `GROQ_API_KEY` | api | required unless `MOCK_LLM=1` |
| `GROQ_MODEL` | api | model id, see §7 |
| `GROQ_STT_MODEL` | api | Whisper model for `/transcribe` (default `whisper-large-v3`) |
| `ELEVENLABS_API_KEY` | api | required for TTS unless `MOCK_LLM=1` |
| `ELEVENLABS_TTS_MODEL` | api | default `eleven_multilingual_v2` |
| `ELEVENLABS_DEFAULT_VOICE_ID` | api | fallback when client omits `voiceId` |
| `MOCK_LLM` | api | `1` replaces LLM and speech providers with mocks |
| `WEB_ORIGIN` | api | CORS allowlist |
| `VITE_API_BASE_URL` | web | API base url |

`.env` is gitignored. `.env.example` holds placeholders only. No key ever goes
into source, docs, fixtures, or `decision.log`.

## 11. Deployment sketch

Static build for `apps/web` behind a CDN; `apps/api` as a single container.
No database, no persistent volume, no backup story, because there is nothing to
back up. Horizontal scaling is trivial for the same reason: the API is stateless.

## 12. Not decided yet

Carried from `decision.log`, listed here so they are visible while designing:

- Session length: fixed turn cap, or the model proposes closing?
- Deterministic risk screen, or prompt-level judgement only? (§8)
- Which Groq model, after hand-reading hard-conversation transcripts (§7)
- Bulgarian only, or Bulgarian + English at launch?
