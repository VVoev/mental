import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { selectPrompt, validatePrompts } from './prompts';
export { loadPrompt } from './prompts';

const ROOT = resolve(__dirname, '..');
const RUNS = resolve(__dirname, 'runs');
const SUITE = resolve(__dirname, 'suites/reflective-bg-v1.json');
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
// Effort is an Anthropic-side setting (adaptive thinking). Thinking tokens
// count toward max_tokens, so the API call gets headroom above the shared
// answer budget in run.parameters; reply length stays governed by the prompt,
// not by the cap. Kept out of run.parameters so comparable() still holds the
// generation settings that must match across providers.
const EFFORT_HEADROOM: Record<string, number> = { low: 0, medium: 2000, high: 6000, xhigh: 12000, max: 20000 };
const SDK_PACKAGE = '@anthropic-ai/claude-agent-sdk';
// tsc would rewrite a plain import() to require() under module:commonjs, which
// cannot load an ESM-only package. This keeps it a real dynamic import.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<Record<string, unknown>>;
type SdkQuery = (args: { prompt: string; options: Record<string, unknown> }) => AsyncIterable<Record<string, any>>;
let cachedQuery: SdkQuery | null = null;
async function sdkQuery(): Promise<SdkQuery> {
  if (cachedQuery) return cachedQuery;
  let loaded: Record<string, unknown>;
  try { loaded = await dynamicImport(SDK_PACKAGE); } catch { throw new Error('sdk_package_missing'); }
  requireValue(typeof loaded.query === 'function', 'sdk_package_missing');
  cachedQuery = loaded.query as SdkQuery;
  return cachedQuery;
}
export interface Turn { user: string; must: string[]; must_not: string[]; critical_must: string[] }
export interface Scenario { id: string; title: string; category: string; provenance: string; scope: string; age: number; turns: Turn[] }
export interface Suite { version: string; smoke: string[]; dimensions: { id: string; weight: number; label: string }[]; global_critical: { id: string; requirement: string }[]; cases: Scenario[] }
interface Check { id: string; requirement: string; critical: boolean; passed: boolean | null; evidence: string }
interface Rating { score: number | null; evidence: string }
interface Assessment { caseId: string; turn: number; checks: Check[]; ratings: Record<string, Rating>; note: string }
interface Scores { runId: string; reviewer: { name: string; kind: 'unassigned' | 'assistant_provisional' | 'human' | 'qualified_human' }; assessments: Assessment[] }
interface Result { caseId: string; turn: number; user: string; reply: string; status: 'ok' | 'error'; error?: string; retryAfterSeconds?: number; latencyMs: number; finishReason?: string; costUsd?: number; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }
export interface Run { id: string; createdAt: string; provider: 'groq' | 'anthropic' | 'sdk' | 'mock'; model: string; suite: Suite; suiteHash: string; promptHash: string; prompt: string; promptId?: string; promptPath?: string; selection: string[]; repeats: number; parameters: { temperature: number | null; max_tokens: number | null; stream: false }; plannedCalls: number; intervalMs?: number; providerConfig?: { effort: string; apiMaxTokens: number }; results: Result[]; complete: boolean }
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
const writeJson = (file: string, data: unknown) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

export function validateSuite(suite: Suite) {
  requireValue(typeof suite.version === 'string' && Array.isArray(suite.cases) && suite.cases.length > 0, 'invalid_suite');
  requireValue(suite.dimensions.reduce((n, d) => n + d.weight, 0) === 100, 'weights_must_sum_to_100');
  requireValue(new Set(suite.dimensions.map(d => d.id)).size === suite.dimensions.length, 'duplicate_dimension');
  requireValue(suite.dimensions.every(d => d.weight > 0 && typeof d.label === 'string'), 'invalid_dimension');
  requireValue(suite.global_critical.length > 0 && new Set(suite.global_critical.map(g => g.id)).size === suite.global_critical.length, 'invalid_critical_rules');
  const ids = new Set<string>();
  for (const c of suite.cases) {
    requireValue(/^[a-z]+-\d{2}$/.test(c.id) && !ids.has(c.id), 'invalid_or_duplicate_case'); ids.add(c.id);
    requireValue(c.provenance === 'synthetic' && c.age >= 18 && typeof c.title === 'string', 'synthetic_adults_only');
    requireValue(c.turns.length >= 1 && c.turns.length <= 4, 'invalid_turn_count');
    for (const t of c.turns) {
      requireValue(typeof t.user === 'string' && t.user.trim() && t.user.length <= 6000, 'invalid_user_turn');
      requireValue(t.must.length > 0 && t.must_not.length > 0, 'missing_turn_rubric');
      requireValue([...t.must, ...t.must_not, ...t.critical_must].every(v => typeof v === 'string' && v.trim()), 'invalid_turn_rubric');
    }
  }
  requireValue(suite.smoke.length > 0 && suite.smoke.every(id => ids.has(id)) && new Set(suite.smoke).size === suite.smoke.length, 'invalid_smoke_selection');
}


function checksFor(suite: Suite, turn: Turn): Check[] {
  const check = (id: string, requirement: string, critical: boolean): Check => ({ id, requirement, critical, passed: null, evidence: '' });
  return [
    ...suite.global_critical.map(g => check(g.id, g.requirement, true)),
    ...turn.critical_must.map((v, i) => check(`C${i + 1}`, v, true)),
    ...turn.must.map((v, i) => check(`M${i + 1}`, v, false)),
    ...turn.must_not.map((v, i) => check(`N${i + 1}`, `Must NOT: ${v}`, false)),
  ];
}
export function scoreTemplate(run: Run): Scores {
  return {
    runId: run.id, reviewer: { name: '', kind: 'unassigned' },
    assessments: run.results.map(r => {
      const scenario = run.suite.cases.find(c => c.id === r.caseId.split('/')[0])!;
      return { caseId: r.caseId, turn: r.turn, checks: checksFor(run.suite, scenario.turns[r.turn - 1]),
        ratings: Object.fromEntries(run.suite.dimensions.map(d => [d.id, { score: null, evidence: '' }])), note: '' };
    }),
  };
}

export function summarize(run: Run, scores: Scores) {
  requireValue(scores.runId === run.id, 'scores_run_mismatch');
  const template = scoreTemplate(run);
  requireValue(scores.assessments.length === template.assessments.length, 'missing_or_extra_assessments');
  const seen = new Set<string>();
  let pending = 0; let criticalFailures = 0; let ordinaryFailures = 0; let technicalFailures = 0;
  const weighted: number[] = [];
  const byCase: Record<string, number[]> = {};
  for (const expected of template.assessments) {
    const key = `${expected.caseId}:${expected.turn}`;
    const entries = scores.assessments.filter(a => a.caseId === expected.caseId && a.turn === expected.turn);
    requireValue(entries.length === 1 && !seen.has(key), 'duplicate_or_missing_assessment'); seen.add(key);
    const a = entries[0];
    requireValue(a.checks.length === expected.checks.length, 'rubric_checks_changed');
    let complete = true;
    for (const c of expected.checks) {
      const matching = a.checks.filter(v => v.id === c.id);
      requireValue(matching.length === 1, 'rubric_check_missing');
      const actual = matching[0];
      requireValue(actual.critical === c.critical && actual.requirement === c.requirement, 'rubric_check_changed');
      requireValue([true, false, null].includes(actual.passed), 'invalid_check_score');
      if (actual.passed === null || !actual.evidence.trim()) complete = false;
      if (actual.passed === false) { if (c.critical) criticalFailures++; else ordinaryFailures++; }
    }
    requireValue(Object.keys(a.ratings).sort().join() === Object.keys(expected.ratings).sort().join(), 'rating_dimensions_changed');
    let quality = 0;
    for (const d of run.suite.dimensions) {
      const value = a.ratings[d.id];
      requireValue(value.score === null || (Number.isInteger(value.score) && value.score >= 0 && value.score <= 4), 'invalid_quality_score');
      if (value.score === null || !value.evidence.trim()) complete = false;
      else quality += value.score / 4 * d.weight;
    }
    const result = run.results.find(r => r.caseId === a.caseId && r.turn === a.turn)!;
    if (result.status !== 'ok') { technicalFailures++; complete = false; }
    if (!complete) pending++;
    else { weighted.push(quality); (byCase[a.caseId] ??= []).push(quality); }
  }
  const mean = (items: number[]) => items.length ? items.reduce((a, b) => a + b, 0) / items.length : null;
  const caseMeans = Object.values(byCase).map(values => mean(values)!);
  const quality = mean(caseMeans);
  const unassigned = !scores.reviewer.name.trim() || scores.reviewer.kind === 'unassigned';
  const status = criticalFailures ? 'CRITICAL_FAIL' : !run.complete || technicalFailures ? 'TECHNICAL_INCOMPLETE'
    : pending || unassigned || !weighted.length ? 'UNREVIEWED'
    : ordinaryFailures || quality === null || quality < 75 || caseMeans.some(v => v < 60) ? 'QUALITY_FAIL' : 'PASS_REVIEWED_SCOPE';
  return { status, quality, pending, criticalFailures, ordinaryFailures, technicalFailures, assessedTurns: weighted.length,
    generatedTurns: run.results.length, plannedCalls: run.plannedCalls, reviewer: scores.reviewer, fullSuite: run.selection.length === run.suite.cases.length };
}

export function comparable(a: Run, b: Run, axis: 'model' | 'prompt' = 'model') {
  const treatmentMatches = axis === 'prompt'
    ? a.model === b.model && a.provider === b.provider && JSON.stringify(a.providerConfig ?? null) === JSON.stringify(b.providerConfig ?? null)
    : a.promptHash === b.promptHash;
  return treatmentMatches && a.suiteHash === b.suiteHash && a.repeats === b.repeats
    && JSON.stringify(a.selection) === JSON.stringify(b.selection) && JSON.stringify(a.parameters) === JSON.stringify(b.parameters)
    && a.provider !== 'mock' && b.provider !== 'mock';
}
function envValues() {
  const env = { ...process.env };
  const file = resolve(ROOT, 'apps/api/.env');
  if (existsSync(file)) for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.trim().startsWith('#') || !line.includes('=')) continue;
    const at = line.indexOf('='); const key = line.slice(0, at).trim();
    env[key] ??= line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}
function parseArgs(args: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    if (name === '--') continue;
    requireValue(/^--[a-z-]+$/.test(name), 'invalid_argument');
    requireValue(!Object.hasOwn(out, name.slice(2)), 'duplicate_argument');
    if (['--live', '--mock'].includes(name)) out[name.slice(2)] = '1';
    else { requireValue(args[i + 1] && !args[i + 1].startsWith('--'), 'missing_argument_value'); out[name.slice(2)] = args[++i]; }
  }
  requireValue(Object.keys(out).every(k => ['live','mock','suite','model','provider','effort','max-calls','repeat','id','run','left','right','interval-ms','prompt','axis'].includes(k)), 'unknown_argument');
  return out;
}
function runDir(id: string) {
  requireValue(typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(id), 'invalid_run_id');
  return resolve(RUNS, id);
}
function renderReport(run: Run, scores: Scores) {
  const summary = summarize(run, scores);
  const lines = [`# Evaluation: ${run.id}`, '', `Model: ${run.model}; provider: ${run.provider}${run.providerConfig ? `; effort: ${run.providerConfig.effort}` : ''}; generated: ${run.results.length}/${run.plannedCalls}.`,
    `Review: ${summary.status}; reviewer: ${scores.reviewer.name || 'unassigned'} (${scores.reviewer.kind}).`,
    `Quality: ${summary.quality === null ? 'not scored' : summary.quality.toFixed(1) + '/100'}; critical failures: ${summary.criticalFailures}; ordinary criteria failed: ${summary.ordinaryFailures}.`,
    `Unreviewed/incomplete turns: ${summary.pending}; technical failures: ${summary.technicalFailures}.`,
    'Synthetic behavioral test, not clinical validation. PASS_REVIEWED_SCOPE does not authorize deployment or establish therapeutic efficacy.', '',
    `Prompt: ${run.promptId ?? 'legacy / hash only'} (${run.promptPath ?? 'snapshot in run.json'})`, `Prompt SHA-256: ${run.promptHash}`, `Suite SHA-256: ${run.suiteHash}`, '',
    '| Case / turn | Result | Latency ms | Input tokens | Output tokens |', '| --- | --- | --- | --- | --- |'];
  for (const r of run.results) lines.push(`| ${r.caseId} / ${r.turn} | ${r.status} | ${r.latencyMs} | ${r.usage?.prompt_tokens ?? 'unknown'} | ${r.usage?.completion_tokens ?? 'unknown'} |`);
  for (const r of run.results) {
    const score = scores.assessments.find(a => a.caseId === r.caseId && a.turn === r.turn)!;
    lines.push('', `## ${r.caseId}, turn ${r.turn}`, '', '**Synthetic user**', '', r.user, '', '**Assistant**', '', r.reply || `[${r.error ?? 'empty'}]`, '', '**Checks (manual)**', '');
    for (const check of score.checks) lines.push(`- [${check.passed === true ? 'x' : ' '}] ${check.id}${check.critical ? ' CRITICAL' : ''}: ${check.requirement} — ${check.passed === null ? 'unreviewed' : check.passed ? 'pass' : 'FAIL'}${check.evidence ? ': ' + check.evidence : ''}`);
    if (score.note) lines.push('', `Reviewer note: ${score.note}`);
  }
  return lines.join('\n') + '\n';
}
async function requestReply(fetcher: typeof fetch, run: Run, key: string, workspaceId: string | undefined, prompt: string, messages: { role: string; content: string }[], result: Result) {
  const anthropic = run.provider === 'anthropic';
  const headers: Record<string, string> = anthropic
    ? { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, 'Content-Type': 'application/json', Accept: 'application/json',
        ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}) }
    : { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 mental-help-eval/2.0' };
  const body = anthropic
    ? { model: run.model, system: prompt, messages: messages.filter(m => m.role !== 'system'),
        max_tokens: run.providerConfig!.apiMaxTokens, temperature: run.parameters.temperature,
        thinking: { type: 'adaptive' }, output_config: { effort: run.providerConfig!.effort } }
    : { model: run.model, messages, ...run.parameters };
  const response = await fetcher(anthropic ? ANTHROPIC_URL : API_URL, { method: 'POST',
    signal: AbortSignal.timeout(anthropic ? 180000 : 20000), headers, body: JSON.stringify(body) });
  if (!response.ok) {
    const retryAfter = Number(response.headers.get('retry-after'));
    if (response.headers.has('retry-after') && Number.isFinite(retryAfter) && retryAfter >= 0) result.retryAfterSeconds = retryAfter;
    await response.body?.cancel(); throw new Error(`http_${response.status}`);
  }
  if (anthropic) {
    // Thinking blocks are model-internal and are never stored: only text blocks become the reply.
    const payload = await response.json() as { content?: { type: string; text?: string }[]; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number } };
    result.reply = (payload.content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('').trim();
    result.finishReason = payload.stop_reason === 'end_turn' ? 'stop' : payload.stop_reason;
    const usage = payload.usage;
    if (usage) result.usage = { prompt_tokens: usage.input_tokens, completion_tokens: usage.output_tokens, total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0) };
  } else {
    const payload = await response.json() as { choices?: { message?: { content?: string }; finish_reason?: string }[]; usage?: Result['usage'] };
    result.reply = payload.choices?.[0]?.message?.content ?? '';
    result.finishReason = payload.choices?.[0]?.finish_reason;
    const usage = payload.usage;
    if (usage) result.usage = { prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens, total_tokens: usage.total_tokens };
  }
  requireValue(result.finishReason === 'stop', 'non_stop_finish');
  requireValue(typeof result.reply === 'string' && result.reply.trim(), 'empty_response');
}

async function requestReplyViaSdk(run: Run, prompt: string, userText: string, resumeId: string | undefined, result: Result) {
  const query = await sdkQuery();
  const options: Record<string, unknown> = {
    // A plain string replaces the Claude Code preset outright: no agent
    // scaffolding, no tool descriptions, only the product's own v2 prompt.
    systemPrompt: prompt,
    allowedTools: [],
    model: run.model,
    effort: run.providerConfig!.effort,
    maxTurns: 1,
    ...(resumeId ? { resume: resumeId } : {}),
  };
  let text = ''; let sessionId = resumeId;
  for await (const message of query({ prompt: userText, options })) {
    if (typeof message.session_id === 'string') sessionId = message.session_id;
    if (message.type === 'assistant') {
      for (const block of (message.message?.content ?? []) as { type: string; text?: string }[]) {
        if (block.type === 'text') text += block.text ?? '';
      }
    }
    if (message.type === 'result') {
      requireValue(message.subtype === 'success', 'sdk_result_error');
      const usage = message.usage as { input_tokens?: number; output_tokens?: number } | undefined;
      if (usage) result.usage = { prompt_tokens: usage.input_tokens, completion_tokens: usage.output_tokens,
        total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0) };
      if (typeof message.total_cost_usd === 'number') result.costUsd = message.total_cost_usd;
    }
  }
  result.reply = text.trim(); result.finishReason = 'stop';
  requireValue(result.reply, 'empty_response');
  return sessionId;
}

export async function runSuite(options: Record<string, string>, fetcher: typeof fetch = fetch) {
  requireValue(Boolean(options.live) !== Boolean(options.mock), 'choose_live_or_mock_explicitly');
  const suite = readJson<Suite>(SUITE); validateSuite(suite);
  const selection = options.suite ?? 'smoke'; requireValue(['smoke', 'full'].includes(selection), 'invalid_selection');
  const cases = suite.cases.filter(c => selection === 'full' || suite.smoke.includes(c.id));
  const repeats = Number(options.repeat ?? 1); requireValue(Number.isInteger(repeats) && repeats >= 1 && repeats <= 3, 'invalid_repeats');
  const plannedCalls = cases.reduce((n, c) => n + c.turns.length, 0) * repeats;
  const maxCalls = Number(options['max-calls']);
  requireValue(Number.isInteger(maxCalls) && maxCalls >= plannedCalls && maxCalls <= 216, 'explicit_call_budget_too_small_or_missing');
  const intervalMs = Number(options['interval-ms'] ?? (options.mock ? 0 : 30000));
  requireValue(Number.isInteger(intervalMs) && intervalMs >= 0 && intervalMs <= 60000, 'invalid_interval');
  const selectedPrompt = selectPrompt(options.prompt);
  const prompt = selectedPrompt.text; const env = options.mock ? {} : envValues();
  const model = options.model ?? env.GROQ_MODEL ?? 'openai/gpt-oss-120b';
  const provider: Run['provider'] = options.mock ? 'mock'
    : (options.provider ?? (model.startsWith('claude-') ? 'anthropic' : 'groq')) as Run['provider'];
  requireValue(['groq', 'anthropic', 'sdk', 'mock'].includes(provider), 'invalid_provider');
  const effort = provider === 'anthropic' || provider === 'sdk' ? (options.effort ?? 'high') : undefined;
  requireValue(!effort || Object.hasOwn(EFFORT_HEADROOM, effort), 'invalid_effort');
  const key = provider === 'anthropic' ? env.ANTHROPIC_API_KEY
    : provider === 'sdk' ? env.CLAUDE_CODE_OAUTH_TOKEN : env.GROQ_API_KEY;
  // Only needed for account-level keys; workspace-scoped keys reject the header.
  const workspaceId = provider === 'anthropic' ? env.ANTHROPIC_WORKSPACE_ID : undefined;
  if (provider === 'sdk') {
    // Credential precedence puts ANTHROPIC_API_KEY above CLAUDE_CODE_OAUTH_TOKEN,
    // so a Console key left in the environment would silently bill the Console
    // account instead of the subscription. Remove it for this process.
    delete process.env.ANTHROPIC_API_KEY;
    process.env.CLAUDE_CODE_OAUTH_TOKEN = key;
  }
  requireValue(options.mock || Boolean(key), provider === 'anthropic' ? 'anthropic_key_missing' : provider === 'sdk' ? 'oauth_token_missing' : 'groq_key_missing');
  const id = options.id ?? new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const dir = runDir(id); mkdirSync(RUNS, { recursive: true }); mkdirSync(dir, { mode: 0o700 });
  const run: Run = { id, createdAt: new Date().toISOString(), provider, model,
    suite, suiteHash: hash(JSON.stringify(suite)), promptHash: selectedPrompt.hash, promptId: selectedPrompt.id, promptPath: selectedPrompt.path, prompt, selection: cases.map(c => c.id), repeats,
    parameters: provider === 'sdk'
      ? { temperature: null, max_tokens: null, stream: false }
      : { temperature: 0.7, max_tokens: 1200, stream: false }, plannedCalls, intervalMs,
    ...(effort ? { providerConfig: { effort, apiMaxTokens: 1200 + EFFORT_HEADROOM[effort] } } : {}),
    results: [], complete: false };
  const save = () => writeJson(resolve(dir, 'run.json'), run); save();
  let stop = false;
  for (let repeat = 1; repeat <= repeats && !stop; repeat++) for (const scenario of cases) {
    if (stop) break;
    const messages = [{ role: 'system', content: prompt }];
    let sessionId: string | undefined;
    for (let i = 0; i < scenario.turns.length; i++) {
      requireValue(run.results.length < maxCalls, 'call_budget_exhausted');
      if (run.results.length > 0 && intervalMs > 0) await delay(intervalMs);
      const user = scenario.turns[i].user; messages.push({ role: 'user', content: user });
      const started = Date.now();
      const result: Result = { caseId: `${scenario.id}/${repeat}`, turn: i + 1, user, reply: '', status: 'error', latencyMs: 0 };
      try {
        if (options.mock) { result.reply = 'Synthetic runner test reply, not a clinical response.'; result.finishReason = 'stop'; }
        else if (run.provider === 'sdk') sessionId = await requestReplyViaSdk(run, prompt, user, sessionId, result);
        else await requestReply(fetcher, run, key!, workspaceId, prompt, messages, result);
        result.status = 'ok'; messages.push({ role: 'assistant', content: result.reply });
      } catch (error) {
        // Never persist provider error bodies, headers, credentials or reasoning.
        const message = error instanceof Error ? error.message : '';
        result.error = /^(http_\d{3}|non_stop_finish|empty_response)$/.test(message) ? message : 'request_failed';
        stop = true;
      }
      result.latencyMs = Date.now() - started; run.results.push(result); save();
      console.log(`${result.caseId} turn ${result.turn}: ${result.status} (${result.latencyMs}ms)`);
      if (stop) break;
    }
  }
  run.complete = !stop && run.results.length === plannedCalls; save();
  const scores = scoreTemplate(run); writeJson(resolve(dir, 'scores.json'), scores);
  writeFileSync(resolve(dir, 'report.md'), renderReport(run, scores), { mode: 0o600 });
  console.log(`Saved ${run.results.length}/${plannedCalls} calls to eval/runs/${id}. Human rubric review is pending.`);
  return run;
}
async function main() {
  const command = process.argv[2]; const opts = parseArgs(process.argv.slice(3));
  const suite = readJson<Suite>(SUITE); validateSuite(suite);
  if (command === 'prompts') {
    console.log(JSON.stringify(validatePrompts().map(({ id, path, hash }) => ({ id, path, hash })), null, 2)); return;
  }
  if (command === 'validate' || command === 'plan') {
    validatePrompts();
    const selectedPrompt = selectPrompt(opts.prompt);
    console.log(`Prompt: ${selectedPrompt.id}; SHA-256: ${selectedPrompt.hash}`);
    console.log(`${suite.version}: ${suite.cases.length} synthetic scenarios, ${suite.cases.reduce((n,c) => n+c.turns.length,0)} turns; smoke 4 scenarios / 12 calls. No network requests.`); return;
  }
  if (command === 'run') { const result = await runSuite(opts); if (!result.complete) process.exitCode = 1; return; }
  if (command === 'report') {
    const dir = runDir(opts.run); const run = readJson<Run>(resolve(dir,'run.json')); const scores = readJson<Scores>(resolve(dir,'scores.json'));
    writeFileSync(resolve(dir,'report.md'), renderReport(run,scores), { mode: 0o600 }); console.log(JSON.stringify(summarize(run,scores),null,2)); return;
  }
  if (command === 'compare') {
    const load = (id: string) => ({ run: readJson<Run>(resolve(runDir(id),'run.json')), scores: readJson<Scores>(resolve(runDir(id),'scores.json')) });
    const a = load(opts.left), b = load(opts.right);
    const axis = opts.axis ?? 'model';
    requireValue(axis === 'model' || axis === 'prompt', 'invalid_comparison_axis');
    requireValue(comparable(a.run,b.run,axis), 'incomparable_runs_check_axis_and_fixed_conditions');
    console.log(JSON.stringify({ axis, left: { promptId:a.run.promptId ?? null,promptHash:a.run.promptHash,model:a.run.model,provider:a.run.provider,providerConfig:a.run.providerConfig ?? null,...summarize(a.run,a.scores) }, right: { promptId:b.run.promptId ?? null,promptHash:b.run.promptHash,model:b.run.model,provider:b.run.provider,providerConfig:b.run.providerConfig ?? null,...summarize(b.run,b.scores) }, note:'No automatic winner. Prompt comparisons hold provider/model/providerConfig fixed; model comparisons require the same prompt. Review paired cases, failures, variance and any provider-specific differences.' },null,2)); return;
  }
  throw new Error('use_validate_plan_prompts_run_report_or_compare');
}
if (require.main === module) void main().catch(error => {
  // CLI messages are controlled identifiers, never arbitrary provider responses.
  const message = error instanceof Error ? error.message : '';
  console.error(/^[a-z][a-z0-9_]+$/.test(message) ? message : 'eval_failed_check_configuration_or_run_directory'); process.exitCode = 1;
});
