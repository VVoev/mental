import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readReply } from '../packages/shared/src/index';
function stream(text: string, size = 7) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < bytes.length; i += size) c.enqueue(bytes.slice(i, i + size)); c.close(); } });
}
test('split UTF-8 and SSE chunks preserve text and require terminal marker', async () => {
  let text = '';
  await readReply(stream('data: {"delta":"Здравей!"}\r\n\r\ndata: [DONE]\n\n', 1), chunk => { text += chunk; });
  assert.equal(text, 'Здравей!');
});
for (const [name, body] of Object.entries({
  'provider error': 'data: {"error":"private-provider-error"}\n\n',
  'truncated stream': 'data: {"delta":"partial"}\n\n',
  'empty answer': 'data: [DONE]\n\n',
  'malformed event': 'data: nope\n\n',
  'wrong delta type': 'data: {"delta":12}\n\n',
  'null event': 'data: null\n\n',
})) test(`reject ${name}`, async () => {
  await assert.rejects(readReply(stream(body), () => {}), error => {
    assert.ok(error instanceof Error); assert.ok(!error.message.includes('private')); return true;
  });
});
