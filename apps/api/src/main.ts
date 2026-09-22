import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SafeErrorFilter } from './common/safe-error.filter';
import { assertLiveAllowed, demoMode } from './common/runtime';

async function bootstrap() {
  if (demoMode()) {
    // Block provider HTTP calls even if a future mock accidentally uses fetch.
    globalThis.fetch = async () => { throw new Error('network_disabled_in_demo'); };
  } else assertLiveAllowed();
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, validationError: { target: false, value: false } }));
  app.useGlobalFilters(new SafeErrorFilter());
  const port = process.env.PORT ?? 3000;
  await app.listen(port, '127.0.0.1');
  console.log(`Local ${demoMode() ? 'demo' : 'live'} API: http://127.0.0.1:${port}`);
}
void bootstrap().catch(() => { console.error('API startup failed; check local configuration.'); process.exitCode = 1; });
