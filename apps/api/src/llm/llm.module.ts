import { Module } from '@nestjs/common';
import { GroqProvider } from './groq.provider';
import { MockLlmProvider } from './mock-llm.provider';
import { demoMode } from '../common/runtime';
export const LLM_PROVIDER = 'LLM_PROVIDER';
@Module({ providers: [{ provide: LLM_PROVIDER, useClass: demoMode() ? MockLlmProvider : GroqProvider }], exports: [LLM_PROVIDER] })
export class LlmModule {}
