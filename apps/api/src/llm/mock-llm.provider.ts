import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import type { ChatMessage, LlmProvider } from './llm-provider.interface';

const replies = JSON.parse(readFileSync(resolve(__dirname, '../../../../e2e/fixtures/replies.json'), 'utf8')) as Record<string, string>;
@Injectable()
export class MockLlmProvider implements LlmProvider {
  async *stream(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<string> {
    const users = messages.filter(m => m.role === 'user');
    const last = users.at(-1)?.content ?? '';
    // Synthetic controls exist only in the explicitly labelled offline provider.
    if (last === '[demo:error]') throw new Error('synthetic_provider_error');
    if (last === '[demo:empty]') return;
    const crisisFixture = /самоуб|самонараня|по-добре да ме няма|няма смисъл|не искам да живея/i.test(last);
    const text = crisisFixture ? replies.crisis : users.length === 1 ? replies.opening : users.length === 2 ? replies.reflect : replies.next;
    for (const chunk of text.match(/.{1,20}/gu) ?? []) {
      await setTimeout(last === '[demo:slow]' ? 500 : 20, undefined, { signal });
      yield chunk;
    }
  }
}
