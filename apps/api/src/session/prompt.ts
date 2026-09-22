import { readFileSync } from 'fs';
import { resolve } from 'path';

// Resolve from this module so tests and dev commands load the same policy.
const PROMPT_PATH = resolve(__dirname, '../../../../docs/prompt/system-prompt.md');

let cachedTemplate: string | null = null;

function loadTemplate(): string {
  if (cachedTemplate) return cachedTemplate;
  const raw = readFileSync(PROMPT_PATH, 'utf-8');
  const match = raw.match(/```\n([\s\S]*?)```/);
  if (!match) {
    throw new Error(`Could not find a fenced code block in ${PROMPT_PATH}`);
  }
  cachedTemplate = match[1].trim();
  return cachedTemplate;
}

// v2 of the prompt (2026-09-19) has no {age}/{presenting_issue}
// placeholders — the presenting issue already reaches the model as the
// first user-role message, and age only gates access server-side (see
// SessionController). This function is kept (rather than inlined) so a
// future prompt revision can reintroduce dynamic context in one place.
export function buildSystemPrompt(): string {
  return loadTemplate();
}
