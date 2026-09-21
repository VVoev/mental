import type { ChatMessage, VoiceInfo } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

interface SendMessagePayload {
  age: number;
  presentingIssue: string;
  messages: ChatMessage[];
}

export async function streamMessage(
  payload: SendMessagePayload,
  onDelta: (text: string) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/session/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

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
        if (parsed.delta) onDelta(parsed.delta);
        if (parsed.error) throw new Error(parsed.error);
      } catch (e) {
        if (e instanceof Error && e.message !== data) {
          // JSON.parse failures land here too (malformed/keep-alive lines);
          // only rethrow errors we explicitly constructed above.
        }
      }
    }
  }
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('audio', blob, 'voice-message.webm');

  const res = await fetch(`${API_BASE}/api/session/transcribe`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Transcription failed: ${res.status}`);
  }
  const body = (await res.json()) as { text: string };
  return body.text;
}

export async function listVoices(): Promise<VoiceInfo[]> {
  const res = await fetch(`${API_BASE}/api/session/voices`);
  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) code = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(code);
  }
  const body = (await res.json()) as { voices: VoiceInfo[] };
  return body.voices;
}

export async function speak(text: string, voiceId?: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/session/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
  });
  if (!res.ok) {
    throw new Error(`Speech synthesis failed: ${res.status}`);
  }
  return res.blob();
}
