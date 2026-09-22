import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LIMITS, type AppConfig } from '@mental-help/shared';
import { SendMessageDto } from './dto/send-message.dto';
import { buildSystemPrompt } from './prompt';
import { LLM_PROVIDER } from '../llm/llm.module';
import type { LlmProvider } from '../llm/llm-provider.interface';
import { RequestLimits, positiveLimit } from '../common/request-limits';
import { demoMode } from '../common/runtime';

@Controller('api/session')
export class SessionController {
  constructor(@Inject(LLM_PROVIDER) private readonly llm: LlmProvider, private readonly limits: RequestLimits) {}

  @Get('config')
  config(): AppConfig { return { mode: demoMode() ? 'demo' : 'live', voiceEnabled: false }; }

  @Post('message')
  async sendMessage(@Body() dto: SendMessageDto, @Res() res: Response) {
    if (dto.age < 18) throw new ForbiddenException();
    const total = dto.messages.reduce((sum, m) => sum + m.content.length, 0) + dto.presentingIssue.length + (dto.goal?.length ?? 0);
    if (total > LIMITS.history || dto.messages.at(-1)?.role !== 'user') throw new BadRequestException();
    const deadline = positiveLimit(process.env.REQUEST_TIMEOUT_MS, LIMITS.timeoutMs, 60000);
    const release = this.limits.acquire();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), deadline);
    const closed = () => abort.abort();
    res.on('close', closed);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    let hasText = false;
    let outputLength = 0;
    try {
      // Goal remains client data; it is never elevated to system instructions.
      const history = dto.messages.map((m, index) => index === 0 && dto.goal?.trim()
        ? { ...m, content: `Моята цел за този разговор: ${dto.goal}\n\n${m.content}` } : m);
      for await (const chunk of this.llm.stream([{ role: 'system', content: buildSystemPrompt() }, ...history], abort.signal)) {
        if (abort.signal.aborted) throw new Error('aborted');
        hasText ||= Boolean(chunk.trim());
        outputLength += chunk.length;
        if (outputLength > 12000) throw new Error('output_limit');
        res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
      }
      if (!hasText) throw new Error('empty_reply');
      res.write('data: [DONE]\n\n');
    } catch {
      // Neither provider exception messages nor transcript content are logged.
      if (!res.destroyed) res.write(`data: ${JSON.stringify({ error: abort.signal.aborted ? 'timeout' : 'reply_failed' })}\n\n`);
    } finally {
      clearTimeout(timer);
      abort.abort();
      res.off('close', closed);
      release();
      res.end();
    }
  }

  // Voice is deferred; no upload parsing or provider call can occur here.
  @Post('transcribe') transcribe() { throw new NotFoundException(); }
  @Post('speak') speak() { throw new NotFoundException(); }
  @Get('voices') voices() { throw new NotFoundException(); }
}
