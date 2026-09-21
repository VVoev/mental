import { Injectable } from '@nestjs/common';
import type { SpeechProvider, SynthesizeResult, VoiceInfo } from './speech-provider.interface';

// Minimal valid MPEG audio frame — enough for browser Audio() in e2e/mock runs.
const MOCK_MP3 = Buffer.from(
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAAFbgBtbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1t//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAABW4A//sQxAADgnABGiAAQBCqgCRMAgEAH//AABR5ZGF0YQAAAAAAAAD/+xDEAAPAAAGiAAAECAAAAAkM4A==',
  'base64',
);

const MOCK_VOICES: VoiceInfo[] = [
  { id: 'mock-voice-kalina', name: 'Mock Kalina' },
  { id: 'mock-voice-borislav', name: 'Mock Borislav' },
];

@Injectable()
export class MockSpeechProvider implements SpeechProvider {
  async transcribe(_audio: Buffer, _mimeType: string): Promise<string> {
    return 'Тестово гласово съобщение.';
  }

  async listVoices(): Promise<VoiceInfo[]> {
    return MOCK_VOICES;
  }

  async synthesize(_text: string, _voiceId?: string): Promise<SynthesizeResult> {
    return { buffer: MOCK_MP3, contentType: 'audio/mpeg' };
  }
}
