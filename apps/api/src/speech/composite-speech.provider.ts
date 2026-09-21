import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SpeechProvider, SynthesizeResult, VoiceInfo } from './speech-provider.interface';

const STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const ELEVENLABS_VOICES_URL = 'https://api.elevenlabs.io/v1/voices';

// Same Cloudflare fix as GroqProvider (apps/api/src/llm/groq.provider.ts) —
// a missing/default User-Agent gets flagged as bot traffic (403, cf 1010).
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) mental-help/0.1';

@Injectable()
export class CompositeSpeechProvider implements SpeechProvider {
  constructor(private readonly config: ConfigService) {}

  private groqApiKey(): string {
    const key = this.config.get<string>('GROQ_API_KEY');
    if (!key) throw new Error('GROQ_API_KEY is not set');
    return key;
  }

  private elevenLabsApiKey(): string {
    const key = this.config.get<string>('ELEVENLABS_API_KEY');
    if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
    return key;
  }

  private defaultVoiceId(): string {
    const id = this.config.get<string>('ELEVENLABS_DEFAULT_VOICE_ID');
    if (!id) throw new Error('ELEVENLABS_DEFAULT_VOICE_ID is not set');
    return id;
  }

  async transcribe(audio: Buffer, mimeType: string): Promise<string> {
    const model = this.config.get<string>('GROQ_STT_MODEL') ?? 'whisper-large-v3';

    const form = new FormData();
    form.append('model', model);
    form.append('response_format', 'json');
    form.append('language', 'bg');
    form.append('file', new Blob([audio], { type: mimeType }), 'audio.webm');

    const res = await fetch(STT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.groqApiKey()}`, 'User-Agent': USER_AGENT },
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Groq transcription error ${res.status}: ${detail}`);
    }
    const body = (await res.json()) as { text?: string };
    return (body.text ?? '').trim();
  }

  async listVoices(): Promise<VoiceInfo[]> {
    const res = await fetch(ELEVENLABS_VOICES_URL, {
      headers: {
        'xi-api-key': this.elevenLabsApiKey(),
        'User-Agent': USER_AGENT,
      },
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`ElevenLabs voices error ${res.status}: ${detail}`);
    }

    const body = (await res.json()) as { voices?: { voice_id: string; name: string }[] };
    return (body.voices ?? []).map((v) => ({ id: v.voice_id, name: v.name }));
  }

  async synthesize(text: string, voiceId?: string): Promise<SynthesizeResult> {
    const model = this.config.get<string>('ELEVENLABS_TTS_MODEL') ?? 'eleven_multilingual_v2';
    const voice = voiceId ?? this.defaultVoiceId();
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.elevenLabsApiKey(),
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        text,
        model_id: model,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`ElevenLabs TTS error ${res.status}: ${detail}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') ?? 'audio/mpeg';
    return { buffer: Buffer.from(arrayBuffer), contentType };
  }
}
