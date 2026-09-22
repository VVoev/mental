import { HttpException, Injectable } from '@nestjs/common';

export function positiveLimit(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) throw new Error('invalid_limit_configuration');
  return parsed;
}

@Injectable()
export class RequestLimits {
  private active = 0;
  private used = 0;
  private readonly concurrency = positiveLimit(process.env.MAX_CONCURRENT_REQUESTS, 3, 10);
  private readonly cap = positiveLimit(process.env.MAX_REQUESTS_PER_PROCESS, 1000, 10000);
  acquire(): () => void {
    if (this.active >= this.concurrency || this.used >= this.cap) throw new HttpException('request_limit', 429);
    this.active++;
    this.used++;
    let released = false;
    return () => { if (!released) { released = true; this.active--; } };
  }
}
