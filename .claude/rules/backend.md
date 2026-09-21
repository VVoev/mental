---
paths:
  - "apps/api/**/*.ts"
---

# Backend rules (apps/api)

## Statelessness
- The API holds no user state between requests. No DB, no Redis, no in-memory
  session map keyed by user. Every request carries the transcript.
- If a feature seems to need server-side memory, stop and raise it. That is an
  architecture change and needs a `decision.log` entry, not a quiet addition.

## LLM access
- All model calls go through the `LlmProvider` interface in `src/llm/`.
  `GroqProvider` is the only implementation today. Controllers and services
  must depend on the interface, never on the Groq SDK directly.
- Groq is reached through its OpenAI-compatible endpoint. Keep the provider thin
  so a second implementation can be dropped in without touching session logic.
- The system prompt is loaded from a single module (`src/session/prompt.ts`),
  sourced from `docs/prompt/system-prompt.md`. Never inline prompt text at a
  call site, and never build it by string concatenation scattered across files.

## Logging
- IMPORTANT: no message content in logs, ever. Not at debug level, not behind a
  flag, not in an exception message. Log ids, durations, token counts, statuses.
- When an LLM call fails, log the provider error without echoing the prompt or
  the user's text back into the log line.

## Hardening
- Rate limit by IP with `@nestjs/throttler`. Anonymous endpoints are abuse
  targets and there is no account to ban.
- Validate every request body with a DTO + `class-validator`. Reject transcripts
  above the configured message/character cap instead of forwarding them.
- The age gate is re-checked server side on every request. Never trust the
  client's word that the user is an adult.
