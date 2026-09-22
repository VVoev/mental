export const LIMITS = { message: 6000, history: 32000, turns: 60, goal: 500, timeoutMs: 20000 } as const;
export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface VoiceInfo { id: string; name: string }
export interface SendMessagePayload { age: number; presentingIssue: string; goal?: string; messages: ChatMessage[] }
export interface AppConfig { mode: 'demo' | 'live'; voiceEnabled: false }

/** Fail closed on malformed events, explicit errors, empty output and missing terminators. */
export async function readReply(body: ReadableStream<Uint8Array>, onDelta: (text: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let hasText = false;
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) throw new Error('incomplete_reply');
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 16000) throw new Error('invalid_stream');
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (!line || line.startsWith(':')) continue;
        if (!line.startsWith('data:')) throw new Error('invalid_stream');
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          if (!hasText) throw new Error('empty_reply');
          return;
        }
        let event: { delta?: unknown; error?: unknown };
        try { event = JSON.parse(data); } catch { throw new Error('invalid_stream'); }
        if (!event || typeof event !== 'object' || event.error) throw new Error('reply_failed');
        if (typeof event.delta !== 'string') throw new Error('invalid_stream');
        total += event.delta.length;
        if (total > 12000) throw new Error('reply_too_large');
        hasText ||= Boolean(event.delta.trim());
        onDelta(event.delta);
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
