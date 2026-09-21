export interface VoiceInfo {
  id: string;
  name: string;
}

export interface SynthesizeResult {
  buffer: Buffer;
  contentType: string;
}

export interface SpeechProvider {
  /** Audio in, transcribed text out. mimeType is whatever the browser recorded (e.g. audio/webm). */
  transcribe(audio: Buffer, mimeType: string): Promise<string>;
  /** Text in, synthesized speech out. voiceId is optional — provider falls back to env default. */
  synthesize(text: string, voiceId?: string): Promise<SynthesizeResult>;
  /** Account voices available for TTS selection. */
  listVoices(): Promise<VoiceInfo[]>;
}
