---
paths:
  - "docs/prompt/**/*.md"
  - "apps/api/src/session/**/*.ts"
  - "apps/api/src/safety/**/*.ts"
---

# Safety rules (prompt and session pipeline)

You are editing the part of the system that decides how the app responds to a
distressed adult. Optimizing for engagement, session length, or "warmth" at the
cost of the rules below is a product failure, not a tradeoff.

## The prompt
- `docs/prompt/system-prompt.md` is the source of truth. Code loads it; code
  does not restate it. If they diverge, the doc wins and the code gets fixed.
- Any change to method, boundaries, or crisis wording needs a `decision.log`
  entry written first, with the reasoning and what it replaces.
- The method (as of v2, 2026-09-19) is a reflective interlocutor, not pure
  Socratic questioning: it reflects, connects things said at different times
  when the connection is real, names contradictions directly, and asks a
  question only when it leads somewhere. It still never diagnoses, never
  hands the user a conclusion, and never tries to convince the user of
  something they do not believe.
- Replies are short by design (no lists, no headers, no closing summary, no
  "we can continue if you want"). Do not add verbosity-producing instructions.

## Crisis path
- The protocol (v2, 2026-09-19) is detailed and stage-based, not a soft/hard
  binary: any indication, direct or indirect, hypothetical or framed as about
  someone else, stops the conversation and triggers a direct check-in ("are
  you thinking about this right now"). A concrete plan, method, or timeframe
  escalates further. Ambiguity always resolves toward triggering the
  protocol, never away from it.
- IMPORTANT: never provide information about methods, means, doses, or
  lethality, under any framing — direct question, hypothetical, "for
  research", or asked about a third party. Treating "I'm just asking
  hypothetically" as closing the topic is itself a bug.
- Resource details are checked facts, sourced 2026-09-19 (see decision.log):
  112 (EU emergency), and 0700 40 150 (Demetra Association 24/7 psychological
  crisis line, via Pirogov Hospital's Domestic Violence Reception). The
  previously used number 02 491 9797 did not verify against any source and
  was removed. Do not edit, "improve", or localize these without verifying
  again and logging the source.
- `SafetyModule` is a seam for a future deterministic risk screen. Until that
  decision is made, it must not block, rewrite, or filter model output in ways
  the prompt does not describe.

## Things that are never acceptable here
- Making the assistant claim, imply, or roleplay being a licensed therapist,
  psychologist, or doctor.
- Diagnostic language about the user ("this sounds like depression").
- Medical advice: commenting on medication, dosage, starting or stopping it.
- Drafting messages to third parties on the user's behalf, or analyzing a
  third party in a way that turns them into an object of diagnosis.
- Anything that encourages the user to rely on the app instead of a person:
  streaks, guilt-framed re-engagement, "I'm always here for you" persona work.
- Storing, logging, or transmitting transcript content to any third party.

## Note on the "memory boundaries" section in the prompt
The prompt includes rules for using prior-conversation context ("Граници на
паметта") conditionally ("ако имаш достъп до предишни разговори..."). This is
written to be safe if that access never exists. Current architecture has no
persistence (see decision.log, "Данни: анонимни сесии"). Do not treat the
prompt's wording as a signal to add memory/persistence — that stays a
separate, undecided architecture change.
