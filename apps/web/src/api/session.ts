import { readReply, type AppConfig, type SendMessagePayload } from '@mental-help/shared';
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export async function loadConfig(): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/api/session/config`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('config_failed');
  const data: AppConfig = await res.json();
  if (!['demo', 'live'].includes(data.mode) || data.voiceEnabled !== false) throw new Error('config_failed');
  return data;
}
export async function streamMessage(payload: SendMessagePayload, onDelta: (text: string) => void, signal: AbortSignal): Promise<void> {
  const res = await fetch(`${API_BASE}/api/session/message`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal,
  });
  if (!res.ok || !res.body) throw new Error(res.status === 429 ? 'request_limit' : 'request_failed');
  await readReply(res.body, onDelta);
}
