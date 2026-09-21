import { Module } from '@nestjs/common';
import { GroqProvider } from './groq.provider';

export const LLM_PROVIDER = 'LLM_PROVIDER';

@Module({
  providers: [{ provide: LLM_PROVIDER, useClass: GroqProvider }],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
