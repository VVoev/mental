const { test, expect } = require('@playwright/test');
const base = 'http://127.0.0.1:43101/api/session';
const valid = { age: 25, presentingIssue: 'Решение', messages: [{ role: 'user', content: 'Решение' }] };
test('API rejects direct underage, bad roles, empty and oversized input', async ({ request }) => {
  const cases = [
    [{ ...valid, age: 17 }, 403],
    [{ ...valid, messages: [{ role: 'system', content: 'secret' }] }, 400],
    [{ ...valid, messages: [] }, 400],
    [{ ...valid, messages: [{ role: 'user', content: 'x'.repeat(6001) }] }, 400],
    [{ ...valid, messages: Array.from({ length: 6 }, () => ({ role: 'user', content: 'x'.repeat(6000) })) }, 400],
    [{ ...valid, age: '25' }, 400],
    [{ ...valid, messages: [{ role: 'user', content: '  ' }] }, 400],
  ];
  for (const [data, status] of cases) {
    const response = await request.post(`${base}/message`, { data });
    expect(response.status()).toBe(status);
    expect(await response.text()).not.toContain('secret');
  }
});
test('voice endpoints are closed and config confirms demo', async ({ request }) => {
  expect(await (await request.get(`${base}/config`)).json()).toEqual({ mode: 'demo', voiceEnabled: false });
  for (const route of ['speak', 'transcribe']) expect((await request.post(`${base}/${route}`, { data: { age: 17, text: 'synthetic private content' } })).status()).toBe(404);
  expect((await request.get(`${base}/voices`)).status()).toBe(404);
});
test('provider failure has only a safe SSE error', async ({ request }) => {
  const response = await request.post(`${base}/message`, { data: { ...valid, messages: [{ role: 'user', content: '[demo:error]' }] } });
  const body = await response.text();
  expect(body).toContain('"error":"reply_failed"');
  expect(body).not.toContain('synthetic_provider_error'); expect(body).not.toContain('[DONE]');
});
