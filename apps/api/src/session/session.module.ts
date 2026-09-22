import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { LlmModule } from '../llm/llm.module';
import { RequestLimits } from '../common/request-limits';

@Module({
  imports: [LlmModule],
  providers: [RequestLimits],
  controllers: [SessionController],
})
export class SessionModule {}
