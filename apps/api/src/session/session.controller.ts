import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Post,
  Res,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SendMessageDto } from './dto/send-message.dto';
import { SpeakDto } from './dto/speak.dto';
import { buildSystemPrompt } from './prompt';
import { LLM_PROVIDER } from '../llm/llm.module';
import type { LlmProvider, ChatMessage } from '../llm/llm-provider.interface';
import { SPEECH_PROVIDER } from '../speech/speech.module';
import type { SpeechProvider } from '../speech/speech-provider.interface';

// Voice messages are short turns in a conversation, not uploads — 15MB is
// generous headroom (a minute+ of webm/opus) while still bounding memory use.
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

@Controller('api/session')
export class SessionController {
  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    @Inject(SPEECH_PROVIDER) private readonly speech: SpeechProvider,
  ) {}

  @Post('message')
  async sendMessage(@Body() dto: SendMessageDto, @Res() res: Response) {
    if (dto.age < 18) {
      throw new ForbiddenException('This app is for adults only.');
    }

    const systemPrompt = buildSystemPrompt();
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...dto.messages];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const chunk of this.llm.stream(messages)) {
        res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (err) {
      // Never forward the raw error (could echo request content); log
      // server-side only, without message content, per CLAUDE.md.
      // eslint-disable-next-line no-console
      console.error('llm stream error:', err instanceof Error ? err.message : err);
      res.write(`data: ${JSON.stringify({ error: 'llm_error' })}\n\n`);
    } finally {
      res.end();
    }
  }

  // Voice input. multipart/form-data, field name "audio". Memory storage
  // only (multer default with no disk/dest configured) — the recording is
  // never written to disk and is discarded once this handler returns, same
  // "nothing about a user is persisted" rule as message content.
  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_BYTES } }))
  async transcribe(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new ForbiddenException('No audio file uploaded.');
    }
    try {
      const text = await this.speech.transcribe(file.buffer, file.mimetype);
      return { text };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('transcription error:', err instanceof Error ? err.message : err);
      throw new ForbiddenException('Transcription failed.');
    }
  }

  @Get('voices')
  async listVoices() {
    try {
      const voices = await this.speech.listVoices();
      return { voices };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error('voices list error:', message);
      if (message.includes('ELEVENLABS_API_KEY is not set')) {
        throw new ServiceUnavailableException({ error: 'tts_not_configured' });
      }
      throw new ServiceUnavailableException({ error: 'voices_unavailable' });
    }
  }

  // Voice output. Takes the assistant's already-generated reply text (never
  // re-derives it) and returns synthesized speech as audio/mpeg.
  @Post('speak')
  async speak(@Body() dto: SpeakDto, @Res() res: Response) {
    try {
      const { buffer, contentType } = await this.speech.synthesize(dto.text, dto.voiceId);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(buffer.length));
      res.send(buffer);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('speech synthesis error:', err instanceof Error ? err.message : err);
      res.status(502).json({ error: 'tts_error' });
    }
  }
}
