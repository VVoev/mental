# Implementation plan — product review and proposed MVP

Date: 2026-09-21. Status: **local Groq text testing enabled and smoke-tested; full model evaluation and public-pilot gates remain open**.

This replaces the previous roadmap. It evaluates the attached AI-team planning framework against the existing mental-help application. It does not select a final product on the owner's behalf. Current implementation: [architecture](architecture.md). Prompt assessment: [system prompt review](prompt/system-prompt.md#review-for-a-possible-v3-2026-09-21). Decision history: [decision.log](../decision.log).

## Evaluation progress — 2026-09-22

- [x] Add 24 synthetic Bulgarian scenarios / 72 turns, separate from legacy personal material.
- [x] Add per-turn must/must-not/critical checks, six anchored 0–4 quality dimensions and explicit failure gates.
- [x] Add reproducible Groq runner with prompt/suite hashes, usage, finish reasons, request caps, pacing and technical-failure handling.
- [x] Add review templates and guarded comparisons; missing review can never pass and critical failures override averages.
- [x] Complete and provisionally review the four-scenario live smoke run: 12/12 paced replies; assistant review 73.4/100, four ordinary criterion failures, zero observed critical failures. First burst attempt remains a separate technical-incomplete result (HTTP 429). This is not qualified human review. See [assessment for `openai/gpt-oss-120b`](../eval/assessments/gpt-oss-120b-20260922.md), indexed in [assessments by model](../eval/assessments/README.md).
- [ ] Run the complete suite and repeated candidate comparison if the initial review warrants it.
- [ ] Obtain independent qualified human safety review; no clinical efficacy claim follows from this suite.

See [evaluation README](../eval/README.md), [scenario catalogue](../eval/scenarios.md), and [rubric](../eval/rubrics/reflective-bg-v1.md).

## Implementation progress

### Latest owner update: Groq enabled for local testing

- [x] Use `GROQ_MODEL=openai/gpt-oss-120b`, `PORT=3000`, `WEB_ORIGIN=http://localhost:5173`.
- [x] `pnpm dev` / `pnpm dev:groq` start real Groq text responses; `pnpm dev:demo` remains explicitly offline.
- [x] ElevenLabs is unused; all voice endpoints remain disabled.
- [x] One synthetic real Groq request succeeded through the browser; `pnpm verify` still passes all 25 automated tests offline.

This explicit owner request supersedes mock-only local testing. The existing Groq key stays server-side. It does not authorize a full model benchmark or public deployment. Current app: http://localhost:5173 (API: http://localhost:3000). The earlier demo-only milestones below are historical completion records.

Updated: 2026-09-21. Check a task only after its stated deliverable and validation are complete. An unchecked item may be partially investigated; it is not finished. This checklist tracks implementation separately from evidence needed for a public pilot.

### Completed preparation

- [x] Assess the attached framework and document three possible first niches.
- [x] Inspect current code and reconcile architecture documentation with implemented behavior.
- [x] Review the system prompt without changing the loaded v2 policy.
- [x] Establish the baseline: both application type checks pass; `pnpm verify` is missing and is tracked under F1.
- [x] Add this progress checklist at the owner's request.

### First-version decisions — selected by the owner

- [x] Select A: decision clarity.
- [x] Select text-only first version; voice deferred.
- [x] Select local mock-only first testing; no paid provider requests.

The owner answered all three choices explicitly. Customer interviews and external safety review remain validation/release gates, separate from the local mock demonstration. No paid requests were made.

### Implementation and verification

- [x] F1: Offline mock LLM, disabled voice routes, synthetic fixtures, lint/unit/E2E tests and passing `pnpm verify`. Demo startup ignores provider env files and blocks outbound fetch; browser tests block non-local requests.
- [x] F2, text scope: server age/input validation, per-message/aggregate/output caps, deadlines and cancellation. All voice routes return 404 before uploads/provider work; voice-specific validation remains deferred with V1.
- [ ] F3, live release: provider-account monetary limits still need confirmation. Implemented and tested: sanitized exceptions, 60 requests/minute per route/IP, three concurrent chat requests, 1,000 calls per process by default, and zero external calls in demo. Process counters reset on restart; they are not durable monetary quotas.
- [x] F4, text scope: explicit stream completion/errors, stop/retry/end/reset, no duplicate turn on retry, cancellation and stale-response protection. No microphone/audio is allocated in the text-only UI.
- [x] P1: Optional editable/clearable goal, decision-clarity onboarding and accurate demo disclosure. Goal is user data, never system authority.
- [ ] P2, model-generated summary: deferred until a prompt candidate is evaluated. The local demo includes a correctable reflection sheet seeded only with the user's verbatim opening, plus user-authored assumptions/unknowns/next step; explicit copy and dismissal are tested. It is labelled a personal note, not AI analysis.
- [x] V1 scope decision: voice explicitly deferred by the owner and removed from the demo UI; voice endpoints disabled. This checkmark records deferral, not completion of voice features.
- [x] Run automated verification: `pnpm verify` passed (lint, both app type checks, 14 unit tests, 11 browser/API tests).
- [x] Start the local application in mock mode and prepare the walkthrough below; desktop and 390px mobile layout inspected, with no horizontal overflow. User feedback is still pending.

### Evidence and release — not prerequisites for a mock walkthrough

- [ ] D1: Interview evidence and documented continue/change/stop decision.
- [ ] S1: Qualified safety review, verified resources and separately budgeted real-model evaluation.
- [ ] R1: Privacy/processor review, pilot consent, operational ownership and release sign-off.
- [ ] Validate usefulness and willingness to pay with the staged experiments below.

The selected local demo is implemented. This is not a production launch or validation of real-model behavior. The loaded v2 prompt is unchanged; only its file-path resolution was made independent of the working directory. The detailed backlog below describes the wider target and remaining acceptance criteria.

### Try the local demo

The current live Groq walkthrough is available at http://localhost:5173 while the local dev processes are running (API: 3000). Enter an adult age and an ordinary or invented decision, send one message, edit the optional goal, open “Моята равносметка”, edit/copy/dismiss it, then select “Приключи и изчисти”. A reload also clears the session. Current replies come from Groq. The reflection sheet remains a user-authored note, not a model-generated summary. With `pnpm dev:demo`, replies are deterministic fixtures.

For a fresh start with the default ports available, run `pnpm dev` for Groq or `pnpm dev:demo` for offline fixtures, then open http://localhost:5173. For automated verification run `pnpm verify`; Playwright owns isolated ports 43101/45174 and never reuses another server. First-time setup: `pnpm install` and `pnpm exec playwright install chromium`.

Synthetic demo controls for testing failure states: `[demo:error]`, `[demo:empty]`, `[demo:slow]`. These only affect the mock provider. Copying deliberately writes to the OS clipboard; ending the session does not erase that clipboard. No automatic conversation or note export is performed.

## 1. Recommendation and evidence boundary

Keep the adult, session-only reflective interlocutor. Test a narrow use case before building more features: **help a person clarify one non-clinical decision, distinguish observations from interpretations, and identify what they still need to learn**. The person makes the decision. An optional, editable end-of-session summary gives the interaction a concrete outcome.

This is a product hypothesis, not evidence of demand, therapeutic benefit, superiority over general AI, or a defensible business. The attachment is a useful development process, not a specification of a new application. The assessment below is based on the attachment and repository source; no market study, clinical review, customer interviews or paid model comparison was performed for this document.

The likely differentiation is the combination of a narrow task, a short understandable flow, careful boundaries, a useful outcome and measured quality. A prompt, Bulgarian language, voice or several agents alone does not establish an advantage. Evaluate against a reasonably configured general assistant, not an intentionally weak baseline.

The recommendation to start with a simple runtime also follows Anthropic's engineering guidance to add agentic complexity only when its performance benefit justifies the latency and cost. Applying that principle to this product is our inference, not a benchmark result for this app. [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents).

## 2. What works in the proposed framework

| Proposal | Assessment | Application here |
| --- | --- | --- |
| Start with a real problem and a specific audience | Keep | Choose one recurring situation and interview people who recently experienced it. |
| Give every feature a benefit and acceptance criteria | Keep | Use the backlog below; reject features without an observable user outcome. |
| Separate product, engineering, design and business reviews | Keep as review responsibilities | One person or one AI session can apply these perspectives. They do not require separate agents or paid calls. |
| A final reviewer resolves disagreement | Keep with limits | Record the evidence and tradeoff. A reviewer cannot manufacture validation or override safety failures. |
| Multi-agent architecture | Conditional, not an MVP requirement | Consider only if a bounded experiment demonstrates an improvement large enough to justify latency, cost and privacy exposure. |
| Design databases, authentication and payments up front | Defer implementation | Record future boundaries. The current session-only MVP needs no user database or account. |
| Validate willingness to pay | Keep | Test usefulness first, then a concrete paid offer. Compliments and stated willingness are weak evidence. |
| Full strategy, polished design and many features before a niche is selected | Reject | Produce a small prototype and evidence before investing in a broad platform. |

Do not put the strategic-director prompt into the user-facing system prompt. It governs development thinking, while the runtime prompt governs how the reflective interlocutor responds to a person.

## 3. Three product directions to discuss

All audiences below are hypotheses: Bulgarian-speaking adults seeking non-clinical reflection. These are alternative first niches, not three modes to ship together.

| Direction | Problem and audience | Proposed solution and benefit | Smallest MVP | Success signal | Main risks |
| --- | --- | --- | --- | --- | --- |
| **A. Clarify a decision — recommended first test** | Adults circling a work or everyday personal decision, without a clear question | Separate the decision, known facts, assumptions, competing priorities and missing information | One text session, editable goal, optional summary confirmed by the user | The user can state the decision and one missing fact or self-chosen next step more clearly | Drifting into prescribing a choice; users may get equal value from a general assistant |
| B. Understand a difficult interaction | Adults replaying a conversation and mixing observation with interpretation | Reflect on their own experience without asserting another person's motives | One event, fact/interpretation distinction, optional personal reflection summary | User identifies a previously unexamined interpretation without treating it as a diagnosis | Mind-reading, blame, escalating relationship conflict; avoid drafting messages for others |
| C. Prepare for a human conversation | Adults unsure what they want to express in an ordinary conversation | Help identify the user's own concern, uncertainty and question to explore | A short personal note, not a message written to another person and not clinical preparation | User reports being better able to articulate their own concern | Becoming a persuasion tool or violating the current prohibition on writing messages to third parties |

For A, exclude medical, legal and investment recommendations from the product promise. The app may help clarify a question, but must not present itself as the qualified professional who answers it. No claim that this scope eliminates sensitive disclosures or crisis situations.

Before selecting a direction, record: first audience and recruiting channel; the recent situation we solve; what participants currently use; the concrete end result; owner budget; and whether voice is essential for that audience. The default recommendation is text first, optional voice later. Keep the existing voice work available for development, but do not assume it belongs in the first pilot.

## 4. Pre-implementation baseline (2026-09-21)

This section records the audit before implementation; use the progress checklist above and the architecture document for current status.

The repository already contained a Git repository, Vue/Pinia frontend, Nest API, Groq streaming LLM provider, Groq speech recognition, ElevenLabs speech synthesis and a mock speech provider. It has two main views: onboarding and session. It is not a greenfield project.

| Area | What the source currently does | Implication |
| --- | --- | --- |
| Transcript | Client sends conversation history with each message; no application transcript database | Keep session-only scope. Full history increases repeated input cost. |
| Age | `POST /message` rejects age below 18; speech routes lack equivalent checks | Adult access policy is incomplete. Self-declared age is not verified identity. |
| Tests | Root has `dev` and `typecheck`; no `verify` script or E2E suite | Existing documentation overstates verification. Build the required loop before release. |
| Offline execution | `MOCK_LLM=1` selects mock speech, but LLM stays Groq | Do not run tests assuming the flag prevents paid/network LLM calls. |
| Safety | Runtime prompt contains the crisis protocol; no `SafetyModule` exists | Prompt compliance is not an independent safeguard or a guarantee. |
| Limits | Message array capped at 60; TTS text at 4,000 characters; audio at 15 MiB | Still need per-message/aggregate limits, deadlines, concurrency and abuse controls. |
| Errors | Provider error bodies can reach server logs through exception messages | “Never logs content” is not currently assured. Sanitize errors before a pilot. |
| Streaming | Browser error handling can swallow an SSE error; early stream endings are not robustly distinguished | A failed answer may look complete. Define and test terminal events. |
| Voice | Recognition result is sent automatically; spoken replies default on | Give users control over recognized text and audio disclosure before a pilot. |
| Session control | No complete end/reset/cancel flow | Add a visible end action with request cancellation and audio cleanup. |
| Privacy | Messages/audio are processed by external providers | “Anonymous” and “no app database” do not mean no third-party processing or retention. |

Inspect the linked architecture for source paths. Previous anecdotal model comparisons are not a reproducible benchmark and are not used to select a model here. Previous roadmap references to a separate numbered product specification are not evidence supplied by this attachment.

## 5. Target MVP scope beyond the local demo

**Must have:** one selected use case; accurate AI/18+/privacy onboarding; accessible text interaction; user control over the session goal; bounded requests and spending; safe failure handling; end/reset; evaluated prompt and crisis flow; an optional user-reviewed summary; minimal voluntary feedback.

**Should have after initial evidence:** clearer progress toward the user's goal, accessible voice if the selected audience needs it, and a second round of usability fixes.

**Outside this MVP:** persistent or encrypted browser memory, profiles, accounts, therapist dashboards, diagnostic scores, treatment plans, autonomous outreach, social features, several runtime agents, vector search, subscriptions and native apps. Persistent memory needs a separate product/privacy decision; encryption does not by itself justify storing sensitive conversations.

### Proposed interaction

1. Explain what the app does, that it is AI, its boundaries and the actual provider processing; collect the existing adult declaration.
2. Ask what the person wants to clarify. Offer a tentative session goal that they can edit or skip.
3. Hold a short reflective conversation. Do not force a questionnaire, repeated summaries or a fixed sequence of questions.
4. On an explicit user action, propose a concise summary: what the user has said, possible interpretations marked as uncertain, and what remains unclear. An optional next step belongs to the user. Do not invent one to complete a template.
5. Let the user correct, dismiss or deliberately copy the summary. No automatic export or persistence. End the session and clear application state.

A summary is optional and must not interrupt crisis handling. A goal or summary is untrusted user/model content, never a higher-priority system instruction.

## 6. Full backlog and acceptance criteria (progress tracked above)

Effort is deliberately not estimated in evenings. After direction selection, estimate tickets against actual staffing and a fixed spend budget. Dependencies and acceptance criteria determine sequence.

| ID / priority | User story and benefit | Work / dependency | Acceptance criteria and validation |
| --- | --- | --- | --- |
| D1 / first | As the owner, I want evidence of a specific unmet need | Choose A, B or C; conduct 6–8 problem interviews before expanding code | Ask about a recent real event, current workaround, frequency and missing outcome; record themes without personal stories or transcripts. End with a documented continue/change/stop decision. |
| F1 / P0 | As a contributor, I want tests that cannot unexpectedly spend money | Implement a true mock LLM and speech mode, then lint/unit/JS Playwright and root `verify` | Verification runs without provider keys and with external network blocked. Fixtures cover ordinary, error and crisis UI flows. Mock results do not count as real-model safety evidence. |
| F2 / P0 | As an adult user, I want consistent access rules and bounded processing | Validate message/STT/TTS input before provider work; add explicit caps, deadlines, aborts and concurrency limits | Invalid/underage requests to every content-processing route make zero provider calls; oversized text/audio/history fail cleanly; cancellation and timeouts are tested. Adult declaration semantics remain clear. |
| F3 / P0 | As the operator, I want a bounded bill without recording conversations | Add sanitized error codes, rate/concurrency control and provider spend limits; depends on F2 | Tests inject provider errors containing sample content and secrets: neither reaches logs/client. Over-budget requests do not invoke providers. No open TTS proxy; constrain voices and usage. |
| F4 / P0 | As a user, I want failures and ending a session to be unambiguous | Repair SSE terminal/error semantics; add stop, retry and end/reset; depends on F1–F2 | Empty/truncated/error streams never appear as completed replies; retry does not duplicate turns. End clears Pinia, aborts fetches, stops microphone/audio, revokes object URLs, and ignores late callbacks. |
| S1 / P0 | As a user, I want product boundaries to hold in difficult conversations | Review current protocol, resource ownership and deterministic safeguards; depends on F1–F3 | Clinically qualified review of the safety flow and authoritative resource verification before a real pilot; adversarial model evaluation with no unresolved hard failures. Every future crisis edit is logged first. |
| P1 / P1 | As a user, I want the conversation to focus on my own question | Add editable/optional session goal and align onboarding with reflection, not “questions only”; depends on D1 and F1 | User can change or omit the goal; it never overrides safety. Keyboard/screen-reader flow works. Treat any goal field as untrusted data. |
| P2 / P1 | As a user, I want a useful result I can correct | Add optional structured summary and correction flow; depends on P1 and prompt evaluation | Every observation is grounded in the current session; inferences are labeled; no diagnosis, invented memory or imposed decision. Copy is explicit. Dismiss/end works without copying. |
| V1 / conditional | As a voice user, I want control over what is sent and played | Keep voice out of the first pilot unless D1 supports it; otherwise add transcript confirmation and opt-in TTS | Edit/cancel recognition before LLM submission; audio stays off until chosen; permission denial, timeout and cleanup work; text remains fully usable. |
| R1 / release | As the owner, I want an honest pilot and a go/no-go decision | Privacy review, participant materials, cost envelope and test sign-off; depends on all pilot features and P0 items | No live pilot until release checklist below passes. Collect separately consented feedback without attaching chats. Record who owns operational incidents and resource updates. |

Do not implement all proposed modules to satisfy a diagram. A small testable service/function inside Nest is preferable when it has a clear responsibility. Shared contracts should remove drift when adding fields; a shared package is optional until its benefit outweighs setup cost, and any departure from repository rules must be explicitly reconciled.

## 7. Prompt experiment before promotion

The current first fenced block in `docs/prompt/system-prompt.md` remains runtime v2. The appended review is not loaded. A v3 candidate should improve grounding, explicit uncertainty, correction handling and session scope; it should not silently redefine the crisis policy.

Use the same model/configuration to compare v2 and candidate v3 before comparing model vendors. Include a baseline with the same safety boundaries and a simple reflective instruction. Randomize answer order for reviewers and record prompt hash, model ID, parameters and rubric version. Distinguish model/provider drift from prompt changes. Do not infer a durable advantage from one favorable run.

Proposed initial suite: **24 synthetic multi-turn scenarios**, four in each category:

- Decision clarity and a user changing the goal.
- Ambiguous facts, contradictions and correction of a wrong interpretation.
- Third-party speculation, diagnosis/medication requests and message-drafting boundaries.
- Direct and indirect crisis cues under the currently approved policy.
- Hypothetical framing, instruction injection and attempts to override boundaries.
- Short/long/noisy Bulgarian input, repetition, abrupt endings and summary grounding.

Add non-crisis controls to detect over-triggering. Do not copy private conversations into fixtures. Define case-specific rubrics before running; do not demand exact wording. Two human reviewers should assess the subset involving safety; a model judge may assist but cannot certify safety or independently establish clinical benefit.

Score task usefulness, evidence grounding, uncertainty, respect for user agency, concision and boundary compliance. Any critical boundary failure blocks promotion regardless of average score. Re-run failed cases and nearby variants after a fix. Finite passing tests reduce uncertainty; they never prove universal safety.

A bounded starting experiment is 24 scenarios × 2 prompt versions × at most 4 generated turns = **at most 192 generation calls**, only after an explicit monetary ceiling is configured. First run a 4-scenario smoke subset; stop on a hard failure. A baseline or repeated trial is a separate budgeted batch, not automatic extra work. No paid experiment is part of this documentation task.

## 8. Validate usefulness, then willingness to pay

Start with interviews and a static flow; do not invite sensitive live conversations into an unreviewed prototype. After P0 gates, recruit 8–12 consenting adult participants for a small usability pilot. They can use an invented or ordinary low-stakes decision and may stop at any time. Do not recruit people in crisis as a target segment.

Pre-register simple exploratory thresholds, for example:

- At least 70% complete the intended flow without facilitator help.
- At least 60% report improved clarity and can name the specific thing that became clearer, without submitting their private story.
- At least half prefer the product flow to the baseline for this particular task.
- Zero unresolved critical failures in the release suite and pilot observations.

These are proposed decision rules, not statistical proof. Report counts and denominators, including dropouts; a pilot of ten people cannot establish efficacy, market size or reliable safety rates. If usefulness fails, revise the niche/flow before upgrading models or adding agents.

NIST's generative-AI risk profile discusses limitations of pre-deployment testing and the role of field/usability testing. It supports using several forms of evidence rather than treating anecdotal examples as validation; it does not prescribe the sample sizes or percentages proposed here. [NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf).

For willingness to pay, show a real, clearly described offer after a useful session, without pressure. Compare a small session bundle with a subscription only if repeat use is observed. First test a non-binding interest signal; a later authorized paid pilot gives stronger evidence. Do not infer demand from a survey answer alone. Choose prices only after unit-cost measurement and interviews; no market price is asserted here.

Potential acquisition hypothesis: recruit through general communities discussing work and everyday decisions, with permission from their organizers. Do not infer or target distress, scrape sensitive communities or send outreach automatically. Retention should mean voluntary reuse for a new task, not longer conversations, dependency or artificial daily streaks. Do not place crisis resources behind a paywall or use distress for upselling.

## 9. Cost, privacy and operational constraints

Measure cost per completed useful session, not just cost per answer:

`session cost = all LLM input/output charges + STT duration charges + TTS charges + infrastructure allocation`

Re-sending full history means later turns include earlier content again. Include summaries, retries, evaluation and any proposed critic/agent calls in the budget. Use current provider billing units and actual usage; do not assume cached tokens or a particular price. Review whether the provider's billed usage includes additional token categories.

Before any pilot set a total experiment budget, per-request output cap, per-session UI turn limit, concurrency cap and provider/account spending ceiling. A client-side session limit is bypassable. Durable quotas or anonymous session identifiers would change the current stateless design and need an explicit decision; ingress limits and provider limits can bound a small pilot without transcript storage. Do not promise a precise per-person cap without a trustworthy identity/quota mechanism.

Keep transcript and audio content out of application logs, analytics, traces and error reporting. Error-code/latency aggregates may suffice; IP-based controls still process network identifiers and need limited retention. Check actual provider terms/settings, hosting/proxy logs, processor arrangements and applicable privacy obligations before onboarding users. Do not promise deletion from provider systems merely because the app cleared memory. Legal classification depends on claims, functionality and data processing; a disclaimer alone settles none of those questions.

Any future billing introduces payment/customer metadata even if chat stays session-only. Any future persistent memory needs separate consent, deletion/access controls, retention choices, threat review and evaluation of wrong or unwanted memories. It is not implicitly approved by a conditional sentence in the prompt.

## 10. Release decision and remaining owner choices

Release only when:

- One audience/use case and the user-facing promise are selected.
- `pnpm verify` exists and passes with network-isolated mocks; live-model evaluation is separately recorded.
- Age/access checks, sanitized logs, spend controls, cancellation and honest error states are tested.
- Qualified safety review and current authoritative resource verification are recorded, with an owner and review date.
- Privacy disclosures match actual provider/hosting behavior, and the pilot consent/feedback design is reviewed.
- The bounded evaluation passes its hard gates and the small pilot supports continuing.

Resolved by the owner: A first, text-only, local mock testing. Remaining before live testing/release: recruitment access, a monetary ceiling and provider controls for evaluation, and safety/privacy reviewers. No runtime agents, persistence, paid evaluations, payments or deployment were authorized or implemented.

The next step is owner feedback on the working local demo. Then resolve the remaining live-release part of F3, evaluate a prompt/summary candidate for P2 and collect D1 evidence. If evidence is weak, change direction before expanding features.
