import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RequestLimits, positiveLimit } from '../apps/api/src/common/request-limits';
import { assertLiveAllowed } from '../apps/api/src/common/runtime';

test('concurrency slots release exactly once and request budget cannot reset by release', () => {
  process.env.MAX_CONCURRENT_REQUESTS = '1'; process.env.MAX_REQUESTS_PER_PROCESS = '2';
  const limits = new RequestLimits();
  const release = limits.acquire(); assert.throws(() => limits.acquire());
  release(); release(); const second = limits.acquire(); second();
  assert.throws(() => limits.acquire());
  delete process.env.MAX_CONCURRENT_REQUESTS; delete process.env.MAX_REQUESTS_PER_PROCESS;
});
test('invalid limits fail closed', () => {
  for (const value of ['0', '-1', 'NaN', '0.5', '99999', '']) assert.throws(() => positiveLimit(value, 3, 10));
});
test('live requests disabled in demo even if live flag is accidentally set', () => {
  process.env.MOCK_LLM = '1'; process.env.ALLOW_LIVE_PROVIDERS = '1';
  assert.throws(assertLiveAllowed);
  delete process.env.MOCK_LLM; delete process.env.ALLOW_LIVE_PROVIDERS;
});
