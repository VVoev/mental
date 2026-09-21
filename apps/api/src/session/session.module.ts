import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { LlmModule } from '../llm/llm.module';
import { SpeechModule } from '../speech/speech.module';

@Module({
  imports: [LlmModule, SpeechModule],
  controllers: [SessionController],
})
export class SessionModule {}
