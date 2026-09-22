import { assertLiveAllowed } from '../common/runtime';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChatMessage, LlmProvider } from './llm-provider.interface';

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Groq sits behind Cloudflare, which flags a missing/default User-Agent as
// bot traffic (HTTP 403, cf error 1010 — confirmed empirically in eval/).
// Always set an explicit one.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) mental-help/0.1';

@Injectable()
export class GroqProvider implements LlmProvider {
  constructor(private readonly config: ConfigService) {}

  async *stream(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<string> {
    assertLiveAllowed();
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not set');
    }
    const model = this.config.get<string>('GROQ_MODEL') ?? 'openai/gpt-oss-120b';

    const res = await fetch(API_URL, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1200,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      await res.body?.cancel();
      throw new Error('provider_request_failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          throw new Error('provider_stream_invalid');
        }
      }
    }
    throw new Error('provider_stream_incomplete');
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
}
