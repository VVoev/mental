import { Module } from '@nestjs/common';
import { CompositeSpeechProvider } from './composite-speech.provider';
import { MockSpeechProvider } from './mock-speech.provider';

export const SPEECH_PROVIDER = 'SPEECH_PROVIDER';

const useMock = process.env.MOCK_LLM === '1';

@Module({
  providers: [
    {
      provide: SPEECH_PROVIDER,
      useClass: useMock ? MockSpeechProvider : CompositeSpeechProvider,
    },
  ],
  exports: [SPEECH_PROVIDER],
})
export class SpeechModule {}
