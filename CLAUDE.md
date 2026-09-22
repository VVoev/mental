# mental-help

Anonymous, session-only web app where an adult user talks to an AI that acts
as a reflective interlocutor to help them see themselves more clearly (not a
pure question-only Socratic bot as of prompt v2). Not a therapy product, not
a medical device, and it must never present itself as one.

Architecture: `docs/architecture.md`. Decision history: `decision.log`.
Canonical AI system prompt: `docs/prompt/system-prompt.md`.

## Commands

```bash
pnpm install              # root, installs all workspaces
pnpm dev                  # web (5173) + api (3000) together
pnpm --filter web dev     # frontend only
pnpm --filter api dev     # backend only
pnpm verify               # lint + typecheck + unit + e2e(mock) — run before calling work done
pnpm test:e2e             # Playwright against MOCK_LLM=1
```

`pnpm verify` is the verification loop. Do not report a task complete without a
passing `pnpm verify` and the output to show for it.

## Safety rules (non-negotiable)

These are product requirements, not style preferences. A change that weakens one
is a bug even if tests pass.

- IMPORTANT: never log, persist, or forward the content of user messages.
  Log request metadata only (timestamp, latency, token counts, status code).
  No database, no file writes, no analytics payloads carrying transcript text.
- The age gate is server-enforced, not just a UI step. Under-18 gets no session.
- Crisis handling lives in the system prompt and in `SafetyModule`. Do not edit
  crisis wording, thresholds, or resource phone numbers without an entry in
  `decision.log` first.
- The AI never diagnoses, prescribes, or claims to be a licensed professional.
  If a code change could make it sound like one, flag it instead of shipping it.
- Secrets live in `.env` only. Never write an API key into source, docs,
  tests, fixtures, or `decision.log`.

## Conventions

- pnpm workspaces. Never `npm install` or `yarn` in this repo.
- TypeScript everywhere except `e2e/`, which is plain JavaScript by decision.
- Vue 3 `<script setup>` + Composition API. No Options API.
- Pinia stores are the only place session state lives on the client.
- NestJS API is stateless. No DB, no sessions, no server-side memory of a user.
  Every request carries the full transcript from the client.
- Shared request/response types live in `packages/shared` and are imported by
  both apps. Do not duplicate a type across `apps/web` and `apps/api`.
- Product-facing copy and the system prompt are in Bulgarian. Code, comments,
  commit messages, and these docs are in English.

## Workflow

- Before a change that spans more than one workspace, write the plan down and
  check it against `docs/architecture.md` rather than improvising.
- If something change the architecture, update the architecture document. `docs/architecture.md`. needs to be always up to date.
- Any decision that would surprise someone reading the code later goes in
  `decision.log` as a new dated entry. Never rewrite or delete old entries.
- New user-visible behavior needs a Playwright spec that runs under `MOCK_LLM=1`.
  Tests must not call the real Groq API.
