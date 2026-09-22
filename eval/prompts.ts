import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = resolve(__dirname, '..');
export const PROMPTS = {
  active: 'docs/prompt/system-prompt.md',
  'v2-baseline': 'docs/prompt/variants/v2-baseline.md',
  'v3-concise': 'docs/prompt/variants/v3-concise.md',
  'v3-guided': 'docs/prompt/variants/v3-guided.md',
  'v3-examples': 'docs/prompt/variants/v3-examples.md',
} as const;
export type PromptId = keyof typeof PROMPTS;
export function loadPrompt(file = resolve(ROOT, PROMPTS.active)): string {
  const match = readFileSync(file, 'utf8').match(/```\n([\s\S]*?)```/);
  if (!match?.[1].trim()) throw new Error('prompt_fence_missing');
  return match[1].trim();
}
export function selectPrompt(id = 'active') {
  if (!Object.hasOwn(PROMPTS, id)) throw new Error('unknown_prompt');
  const path = PROMPTS[id as PromptId];
  const text = loadPrompt(resolve(ROOT, path));
  return { id: id as PromptId, path, text, hash: createHash('sha256').update(text).digest('hex') };
}
export function validatePrompts() {
  const baseline = selectPrompt('v2-baseline').text;
  const start = baseline.indexOf('Криза\n');
  const end = baseline.indexOf('\nГраници на паметта');
  if (start < 0 || end <= start) throw new Error('baseline_crisis_section_missing');
  const crisis = baseline.slice(start, end);
  let sharedCore: string | undefined;
  for (const id of ['v3-concise', 'v3-guided', 'v3-examples']) {
    const text = selectPrompt(id).text;
    if (text.slice(text.indexOf('Криза\n')) !== crisis) throw new Error('candidate_crisis_changed');
    const method = text.indexOf('\nМетод:');
    if (method < 0) throw new Error('candidate_method_missing');
    const core = text.slice(0, method);
    if (sharedCore !== undefined && sharedCore !== core) throw new Error('candidate_shared_core_changed');
    sharedCore = core;
  }
  return Object.keys(PROMPTS).map(id => selectPrompt(id));
}
