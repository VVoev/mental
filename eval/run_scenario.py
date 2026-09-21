#!/usr/bin/env python3
"""
eval/run_scenario.py — manual harness for testing docs/prompt/system-prompt.md
against Groq. Stdlib only, no pip installs.

Scenarios live in eval/scenarios/. Optional follow-up turns are in scenario["turns"].
Rubrics live in eval/rubrics/<id>.json — criteria for hand-scoring, not golden replies.

Usage:
  python3 eval/run_scenario.py start eval/scenarios/01-stuck-career.json
  python3 eval/run_scenario.py reply 01-stuck-career "follow-up message"
  python3 eval/run_scenario.py show 01-stuck-career
  python3 eval/run_scenario.py run eval/scenarios/03-marriage-contradictions.json
  python3 eval/run_scenario.py rubric 03-marriage-contradictions

Reads GROQ_API_KEY (required) and GROQ_MODEL (optional, default
openai/gpt-oss-120b) from apps/api/.env. Never prints the key.
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVAL_DIR = Path(__file__).resolve().parent
PROMPT_FILE = ROOT / "docs" / "prompt" / "system-prompt.md"
TRANSCRIPTS_DIR = EVAL_DIR / "transcripts"
RUBRICS_DIR = EVAL_DIR / "rubrics"
ENV_FILE = ROOT / "apps" / "api" / ".env"
API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-oss-120b"


def load_env():
    env = dict(os.environ)
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env


def load_system_prompt():
    text = PROMPT_FILE.read_text(encoding="utf-8")
    match = re.search(r"```\n(.*?)```", text, re.DOTALL)
    if not match:
        raise SystemExit(f"Could not find a fenced code block in {PROMPT_FILE}")
    return match.group(1).strip()


def call_groq(env, messages):
    api_key = env.get("GROQ_API_KEY")
    if not api_key:
        raise SystemExit(
            "GROQ_API_KEY is empty. Edit .env yourself in a local editor and "
            "paste the key there — never pass it as a command-line argument."
        )
    model = env.get("GROQ_MODEL", DEFAULT_MODEL)
    payload = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1200,
    }).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            # Groq sits behind Cloudflare, which flags the default
            # Python-urllib UA as bot traffic (HTTP 403, cf error 1010).
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) mental-help-eval/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Groq API error {e.code}: {detail}")
    return body["choices"][0]["message"]["content"]


def transcript_path(scenario_id):
    TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    return TRANSCRIPTS_DIR / f"{scenario_id}.json"


def rubric_path(scenario_id):
    return RUBRICS_DIR / f"{scenario_id}.json"


def load_rubric(scenario_id):
    path = rubric_path(scenario_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def follow_up_turns(scenario):
    """User messages after presenting_issue (turns with non-null content)."""
    turns = scenario.get("turns") or []
    return [t for t in turns if t.get("content")]


def print_exchange(messages):
    label = {"user": "USER", "assistant": "AI", "system": "SYSTEM"}
    for m in messages:
        print(f"\n--- {label[m['role']]} ---\n{m['content']}")


def print_rubric_slice(rubric, after_user_turn):
    if not rubric:
        return
    for entry in rubric.get("turns", []):
        if entry.get("after_user_turn") != after_user_turn:
            continue
        hard = " [HARD FAIL if must_not violated]" if entry.get("hard_fail_if_must_not_violated") else ""
        print(f"\n=== RUBRIC turn {after_user_turn}: {entry.get('focus', '')}{hard} ===")
        print("MUST:")
        for item in entry.get("must", []):
            print(f"  [ ] {item}")
        print("MUST NOT:")
        for item in entry.get("must_not", []):
            print(f"  [ ] {item}")
        return


def save_transcript(scenario, messages):
    tp = transcript_path(scenario["id"])
    tp.write_text(
        json.dumps({"scenario": scenario, "messages": messages}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return tp


def assistant_replies(messages):
    return [m for m in messages if m["role"] == "assistant"]


def cmd_start(scenario_file):
    scenario = json.loads(Path(scenario_file).read_text(encoding="utf-8"))
    scenario_id = scenario["id"]
    system_prompt = load_system_prompt()

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": scenario["presenting_issue"]},
    ]
    env = load_env()
    reply = call_groq(env, messages)
    messages.append({"role": "assistant", "content": reply})

    tp = save_transcript(scenario, messages)
    print_exchange(messages[-2:])
    print_rubric_slice(load_rubric(scenario_id), 1)
    print(f"\n[saved to {tp.relative_to(ROOT)}]")


def cmd_reply(scenario_id, text):
    tp = transcript_path(scenario_id)
    if not tp.exists():
        raise SystemExit(f"No transcript for '{scenario_id}'. Run 'start' first.")
    data = json.loads(tp.read_text(encoding="utf-8"))
    messages = data["messages"]
    messages.append({"role": "user", "content": text})
    env = load_env()
    reply = call_groq(env, messages)
    messages.append({"role": "assistant", "content": reply})
    data["messages"] = messages
    tp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print_exchange(messages[-2:])
    turn_n = len(assistant_replies(messages))
    print_rubric_slice(load_rubric(scenario_id), turn_n)


def cmd_run(scenario_file):
    """Run presenting_issue plus all follow-up turns in the scenario file."""
    scenario = json.loads(Path(scenario_file).read_text(encoding="utf-8"))
    scenario_id = scenario["id"]
    rubric = load_rubric(scenario_id)
    system_prompt = load_system_prompt()
    env = load_env()

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": scenario["presenting_issue"]},
    ]
    reply = call_groq(env, messages)
    messages.append({"role": "assistant", "content": reply})
    print(f"\n########## TURN 1 (presenting_issue) ##########")
    print_exchange(messages[-2:])
    print_rubric_slice(rubric, 1)

    for follow in follow_up_turns(scenario):
        n = follow.get("n")
        messages.append({"role": "user", "content": follow["content"]})
        reply = call_groq(env, messages)
        messages.append({"role": "assistant", "content": reply})
        print(f"\n########## TURN {n} ##########")
        print_exchange(messages[-2:])
        print_rubric_slice(rubric, n)

    tp = save_transcript(scenario, messages)
    print(f"\n[saved to {tp.relative_to(ROOT)}]")
    print("Hand-score against the rubric checklists above (or: python3 eval/run_scenario.py rubric %s)" % scenario_id)


def cmd_show(scenario_id):
    tp = transcript_path(scenario_id)
    if not tp.exists():
        raise SystemExit(f"No transcript for '{scenario_id}'.")
    data = json.loads(tp.read_text(encoding="utf-8"))
    print_exchange([m for m in data["messages"] if m["role"] != "system"])


def cmd_rubric(scenario_id):
    """Print rubric checklists next to each assistant reply in the transcript."""
    rubric = load_rubric(scenario_id)
    if not rubric:
        raise SystemExit(f"No rubric at {rubric_path(scenario_id)}")
    tp = transcript_path(scenario_id)
    if not tp.exists():
        raise SystemExit(
            f"No transcript for '{scenario_id}'. Run start/run first, then score."
        )
    data = json.loads(tp.read_text(encoding="utf-8"))
    replies = assistant_replies(data["messages"])
    print(f"Rubric for {scenario_id} (scoring={rubric.get('scoring', 'manual')})")
    print(rubric.get("note", ""))
    for i, reply in enumerate(replies, start=1):
        print(f"\n--- ASSISTANT reply #{i} ---\n{reply['content']}")
        print_rubric_slice(rubric, i)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(1)
    cmd = sys.argv[1]
    if cmd == "start" and len(sys.argv) == 3:
        cmd_start(sys.argv[2])
    elif cmd == "reply" and len(sys.argv) == 4:
        cmd_reply(sys.argv[2], sys.argv[3])
    elif cmd == "run" and len(sys.argv) == 3:
        cmd_run(sys.argv[2])
    elif cmd == "show" and len(sys.argv) == 3:
        cmd_show(sys.argv[2])
    elif cmd == "rubric" and len(sys.argv) == 3:
        cmd_rubric(sys.argv[2])
    else:
        print(__doc__)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
