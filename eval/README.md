# Behavioral evaluation and model comparison

Current suite: **24 synthetic Bulgarian scenarios, 72 user turns, six categories**. Each turn has a rubric; a four-case / 12-call smoke subset provides a bounded first pass. Evaluate the current `openai/gpt-oss-120b` configuration before choosing a replacement. This measures AI conversational behavior, not clinical efficacy or suitability to practise psychotherapy.

- [Scenario inputs and per-turn criteria](suites/reflective-bg-v1.json)
- [Anchored scoring rubric and decision rules](rubrics/reflective-bg-v1.md)
- [Human-readable scenario catalogue](scenarios.md)
- [Assessments by model](assessments/README.md)

## Offline preparation

```bash
pnpm eval validate
pnpm eval plan
pnpm eval run --mock --suite smoke --max-calls 12 --id local-runner-check
```

Validate/plan use no network and create no run. Mock tests the runner, not the model. Run IDs cannot overwrite an existing directory. `pnpm verify` validates the suite and tests scoring/guard behavior offline in addition to the app tests.

## Run the selected Groq model

```bash
pnpm eval run --live --suite smoke --model openai/gpt-oss-120b --max-calls 12 --id groq-v2-smoke-01
```

`--live` and an explicit call budget are required. The key is read privately from the environment or `apps/api/.env`; do not paste it into commands. Live runs send **only the new synthetic scenarios** to Groq. No ElevenLabs, external tools, automated judges, parallel agent team or automatic retries are used.

The runner snapshots the actual first fenced system prompt, suite/rubric hash, model ID, 0.7 temperature and 1,200 output-token setting. Reasoning effort is left at the provider default, matching the app's request. Requests are non-streaming for usage/finish-reason capture, so measured latency is total response latency, not the app's time to first token. This is a model-level evaluation; separate browser tests cover age validation, streaming and session controls. The scripted cases do not exercise the optional goal field.

Timeout is 20 seconds. Live requests are spaced 30 seconds apart by default (`--interval-ms`, up to 60,000); this reduces burst pressure without bypassing account limits. A 429 remains a technical failure; its numeric Retry-After header is saved when provided, with no automatic retry. A technical failure stops the batch and marks the run incomplete. No dependent follow-ups are sent after a failed turn. Scripted follow-ups are replayed verbatim for comparability, even if a model's question differs; reviewers must account for that limitation. Each new case starts with fresh history. Repetitions are independent conversations.

Call limits bound request count; they are **not monetary provider-account limits**. Inspect returned token usage and actual billing. No automatic fallback model is invoked. Full evaluation is a separate deliberate run:

```bash
pnpm eval run --live --suite full --model openai/gpt-oss-120b --max-calls 72 --id groq-v2-full-01
# Repeated final evaluation, only when the larger run is desired:
pnpm eval run --live --suite full --model openai/gpt-oss-120b --repeat 3 --max-calls 216 --id groq-v2-repeat-01
```

## Review and report

Each ignored `eval/runs/<id>/` contains:

- `run.json`: synthetic conversations, exact prompt/suite snapshot, settings, timing, finish reason and usage when available. No API key, response headers, provider error bodies or hidden reasoning.
- `scores.json`: unfilled checks and 0–4 ratings. Enter reviewer identity/kind and evidence for every score. Use `assistant_provisional` for AI-written review; a human reviewer must not be impersonated.
- `report.md`: readable exchanges, rubric checklists and a status. Generated replies alone never create a passing score.

```bash
pnpm eval report --run groq-v2-smoke-01
```

Ordinary and critical checks both need evidence. Missing checks/changed rubric dimensions are rejected. Critical failures take precedence over a high score. Missing review remains unreviewed. If a batch is incomplete, recorded quality is partial and cannot be used as a pass.

## Compare a future candidate

Run an explicitly chosen, supported Groq model with the same suite, prompt, parameters and repetitions, then:

```bash
pnpm eval compare --left groq-v2-full-01 --right candidate-v2-full-01
```

Comparison rejects mismatched prompt/suite/conditions and mock runs. It reports provenance and failures, never chooses a winner automatically. Same API parameters do not guarantee equal internal reasoning budgets across models. Adding another provider requires an explicit adapter and privacy/cost review; do not send the same credentials to arbitrary endpoints.

## Privacy and legacy harness

This new suite is explicitly synthetic. `eval/scenarios/01-*` and `02-*` document user-derived material and are **excluded**, as is the old long mixed scenario. Do not import real conversations into the new suite or send them to an evaluation service. Generated synthetic run artifacts are ignored by Git. The app's no-transcript-storage rule remains in force for real sessions; offline synthetic evaluation artifacts are a separate test purpose requested by the owner.

`run_scenario.py` remains a legacy manual harness; it does not offer the new call-budget, immutable-run, reproducibility or scoring protections. Do not use it for the benchmark or real personal material. Its old samples are not evidence that one model is better than another.
