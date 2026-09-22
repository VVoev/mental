import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { SessionController } from '../apps/api/src/session/session.controller';
import { RequestLimits } from '../apps/api/src/common/request-limits';
import type { LlmProvider } from '../apps/api/src/llm/llm-provider.interface';

class ResponseStub extends EventEmitter {
  output = ''; destroyed = false;
  setHeader() {} flushHeaders() {} end() {}
  write(data: string) { this.output += data; }
}
const valid = { age: 25, presentingIssue: 'Synthetic question', messages: [{ role: 'user' as const, content: 'Synthetic question' }] };
const response = (stub: ResponseStub) => stub as unknown as Parameters<SessionController['sendMessage']>[1];
const root = process.cwd();

test('underage and aggregate limits prevent calling a provider', async () => {
  let calls = 0;
  const provider: LlmProvider = { async *stream() { calls++; yield 'text'; } };
  const controller = new SessionController(provider, new RequestLimits());
  await assert.rejects(controller.sendMessage({ ...valid, age: 17 }, response(new ResponseStub())));
  await assert.rejects(controller.sendMessage({ ...valid, messages: Array.from({ length: 6 }, () => ({ role: 'user', content: 'x'.repeat(6000) })) }, response(new ResponseStub())));
  assert.equal(calls, 0);
});

test('provider error content never reaches response or console', async () => {
  process.chdir(resolve(root, 'apps/api'));
  const logged: unknown[] = [];
  const original = console.error;
  console.error = (...values: unknown[]) => { logged.push(values); };
  try {
    const provider: LlmProvider = { async *stream() { yield 'partial'; throw new Error('PRIVATE_TEST_CONTENT SECRET_TEST_KEY'); } };
    const stub = new ResponseStub();
    await new SessionController(provider, new RequestLimits()).sendMessage(valid, response(stub));
    assert.ok(stub.output.includes('reply_failed'));
    assert.ok(!stub.output.includes('[DONE]'));
    assert.ok(!JSON.stringify([stub.output, logged]).includes('PRIVATE_TEST_CONTENT'));
    assert.ok(!JSON.stringify([stub.output, logged]).includes('SECRET_TEST_KEY'));
  } finally { process.chdir(root); console.error = original; }
});

test('deadline aborts work and releases concurrency slot', async () => {
  process.chdir(resolve(root, 'apps/api'));
  process.env.REQUEST_TIMEOUT_MS = '20'; process.env.MAX_CONCURRENT_REQUESTS = '1';
  const limits = new RequestLimits();
  let aborted = false;
  const provider: LlmProvider = { async *stream(_messages, signal) {
    try { await setTimeout(5000, undefined, { signal }); yield 'too late'; }
    finally { aborted = Boolean(signal?.aborted); }
  } };
  try {
    const stub = new ResponseStub();
    await new SessionController(provider, limits).sendMessage(valid, response(stub));
    assert.ok(aborted); assert.ok(stub.output.includes('timeout'));
    const release = limits.acquire(); release();
  } finally { process.chdir(root); delete process.env.REQUEST_TIMEOUT_MS; delete process.env.MAX_CONCURRENT_REQUESTS; }
});

test('client disconnect cancels provider', async () => {
  process.chdir(resolve(root, 'apps/api'));
  const stub = new ResponseStub();
  let aborted = false;
  const provider: LlmProvider = { async *stream(_messages, signal) {
    stub.emit('close');
    aborted = Boolean(signal?.aborted);
    signal?.throwIfAborted();
    yield 'never';
  } };
  try {
    await new SessionController(provider, new RequestLimits()).sendMessage(valid, response(stub));
    assert.ok(aborted); assert.ok(!stub.output.includes('never'));
  } finally { process.chdir(root); }
});
