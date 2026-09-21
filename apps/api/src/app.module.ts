import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SessionModule } from './session/session.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SessionModule],
  controllers: [HealthController],
})
export class AppModule {}
