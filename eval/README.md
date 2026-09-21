# Eval harness

Manual prompt evaluation against Groq. **Not** golden replies — the model has
no single correct answer. Score transcripts against rubrics by hand.

## Layout

```
eval/
├── scenarios/     # inputs (presenting_issue + optional follow-up turns)
├── rubrics/       # must / must_not per turn (pass/fail criteria)
├── transcripts/   # artifacts from a run (gitignored if you prefer; currently tracked samples)
└── run_scenario.py
```

## Commands

```bash
# First turn only
python3 eval/run_scenario.py start eval/scenarios/01-stuck-career.json
python3 eval/run_scenario.py reply 01-stuck-career "follow-up…"

# Full multi-turn scenario (all turns in the JSON)
python3 eval/run_scenario.py run eval/scenarios/03-marriage-contradictions.json

# Print transcript
python3 eval/run_scenario.py show 03-marriage-contradictions

# Print assistant replies + rubric checklists for hand scoring
python3 eval/run_scenario.py rubric 03-marriage-contradictions
```

Requires `GROQ_API_KEY` in `apps/api/.env`. Never pass keys on the CLI.

## Scoring rules

- **Scenario** = stimulus.
- **Rubric** = what pass/fail means for each turn.
- **Transcript** = one run's output; re-run after prompt changes and compare.
- Crisis turns marked `hard_fail_if_must_not_violated` fail the whole scenario
  if any `must_not` item is violated (methods, doses, abandoning crisis, etc.).
